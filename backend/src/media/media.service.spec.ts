import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { SupabaseService } from '../config/supabase.config';
import { TrailsService } from '../trails/trails.service';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit'].forEach(
    (m) => {
      self[m] = jest.fn(() => self);
    },
  );
  self.single = jest.fn().mockResolvedValue(result);
  self.maybeSingle = jest.fn().mockResolvedValue(result);
  self.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return self;
}

const queues = new Map<string, Builder[]>();
function onTable(table: string, result: object): Builder {
  const builder = makeBuilder(result);
  queues.set(table, [...(queues.get(table) ?? []), builder]);
  return builder;
}

const bucket = {
  upload: jest.fn(),
  getPublicUrl: jest.fn((path: string) => ({
    data: {
      publicUrl: `https://example.supabase.co/storage/v1/object/public/bucket/${path}`,
    },
  })),
  list: jest.fn(),
  remove: jest.fn(),
};

const mockAdmin = {
  from: jest.fn((table: string) => {
    const next = queues.get(table)?.shift();
    if (!next) throw new Error(`Unexpected query on ${table}`);
    return next;
  }),
  storage: { from: jest.fn(() => bucket) },
};

const mockTrails = { invalidateCache: jest.fn() };

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.alloc(8),
]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

describe('MediaService', () => {
  let service: MediaService;
  let warnLog: jest.SpyInstance;
  let errorLog: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => mockAdmin },
        },
        { provide: TrailsService, useValue: mockTrails },
      ],
    }).compile();

    service = module.get(MediaService);
    jest.clearAllMocks();
    queues.clear();
    bucket.upload.mockResolvedValue({ data: {}, error: null });
    bucket.list.mockResolvedValue({ data: [], error: null });
    bucket.remove.mockResolvedValue({ data: [], error: null });
    warnLog = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnLog.mockRestore();
    errorLog.mockRestore();
  });

  describe('file type', () => {
    it('stores a proof photo under the sniffed extension and content type', async () => {
      const result = await service.uploadProofPhoto(PNG);

      const [path, file, options] = bucket.upload.mock.calls[0];
      expect(path).toMatch(/^proofs\/[0-9a-f-]{36}\.png$/);
      expect(file).toBe(PNG);
      expect(options).toEqual({ contentType: 'image/png', upsert: false });
      expect(result.url).toContain('/storage/v1/object/public/');
    });

    it('answers 415 for a file that is not a supported image', async () => {
      await expect(service.uploadProofPhoto(HTML)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(bucket.upload).not.toHaveBeenCalled();
    });

    it('does not accept videos where only images are allowed', async () => {
      await expect(service.uploadProofPhoto(MP4)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('answers 400 for an empty body', async () => {
      await expect(service.uploadProofPhoto(Buffer.alloc(0))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('hides storage error details from the client', async () => {
      bucket.upload.mockResolvedValue({
        data: null,
        error: { message: 'bucket policy xyz' },
      });

      const error = (await service
        .uploadProofPhoto(JPEG)
        .catch((e: unknown) => e)) as Error;

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toBe('Upload failed');
    });
  });

  describe('uploadAvatar', () => {
    it('versions the URL, updates the profile and removes avatars with other extensions', async () => {
      const profile = onTable('profiles', { error: null });
      bucket.list.mockResolvedValue({
        data: [
          { name: 'user-1.png' },
          { name: 'user-1.jpg' },
          { name: 'user-10.jpg' },
        ],
        error: null,
      });

      const result = await service.uploadAvatar('user-1', JPEG);

      expect(bucket.upload).toHaveBeenCalledWith('avatars/user-1.jpg', JPEG, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      expect(result.url).toMatch(/avatars\/user-1\.jpg\?v=\d+$/);
      expect(profile.update).toHaveBeenCalledWith({ avatar_url: result.url });
      expect(profile.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(bucket.remove).toHaveBeenCalledWith(['avatars/user-1.png']);
    });

    it('fails when the profile cannot be updated', async () => {
      onTable('profiles', { error: { code: 'XX000', message: 'boom' } });

      await expect(service.uploadAvatar('user-1', JPEG)).rejects.toThrow(
        'Internal server error',
      );
      expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('still succeeds when old files cannot be cleaned up', async () => {
      onTable('profiles', { error: null });
      bucket.list.mockResolvedValue({ data: null, error: { message: 'nope' } });

      const result = await service.uploadAvatar('user-1', JPEG);

      expect(result.url).toContain('user-1.jpg?v=');
      expect(warnLog).toHaveBeenCalled();
    });
  });

  describe('uploadHikePhoto', () => {
    it('creates the trail_photos row and refreshes the trail cache', async () => {
      onTable('trails', { data: { id: 'trail-1' }, error: null });
      const photos = onTable('trail_photos', {
        data: { id: 'photo-1' },
        error: null,
      });

      const result = await service.uploadHikePhoto(
        'user-1',
        'trail-1',
        JPEG,
        'მწვერვალი',
      );

      expect(result).toEqual({ id: 'photo-1' });
      expect(photos.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          trail_id: 'trail-1',
          user_id: 'user-1',
          caption: 'მწვერვალი',
        }),
      );
      expect(bucket.upload.mock.calls[0][0]).toMatch(
        /^hike-photos\/trail-1\/[0-9a-f-]{36}\.jpg$/,
      );
      expect(mockTrails.invalidateCache).toHaveBeenCalledWith('trail-1');
    });

    it('answers 404 for an unknown trail before uploading', async () => {
      onTable('trails', { data: null, error: null });

      await expect(
        service.uploadHikePhoto('user-1', 'nope', JPEG),
      ).rejects.toThrow(NotFoundException);
      expect(bucket.upload).not.toHaveBeenCalled();
    });
  });

  describe('uploadTrailMedia', () => {
    it('stores a video as video media', async () => {
      onTable('trails', { data: { id: 'trail-1' }, error: null });
      onTable('trail_media', { data: [{ sort_order: 2 }], error: null });
      const insert = onTable('trail_media', {
        data: { id: 'm1' },
        error: null,
      });

      await service.uploadTrailMedia('trail-1', MP4, null);

      expect(bucket.upload.mock.calls[0][0]).toMatch(/\.mp4$/);
      expect(bucket.upload.mock.calls[0][2]).toEqual({
        contentType: 'video/mp4',
        upsert: false,
      });
      expect(insert.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'video', sort_order: 3 }),
      );
      expect(mockTrails.invalidateCache).toHaveBeenCalledWith('trail-1');
    });
  });

  describe('deleteMedia', () => {
    it('removes the file and the row and refreshes the trail cache', async () => {
      onTable('trail_media', {
        data: {
          id: 'm1',
          trail_id: 'trail-1',
          url: 'https://example.supabase.co/storage/v1/object/public/trail-media/trails/trail-1/a.jpg',
        },
        error: null,
      });
      onTable('trail_media', { error: null });

      await service.deleteMedia('m1');

      expect(bucket.remove).toHaveBeenCalledWith(['trails/trail-1/a.jpg']);
      expect(mockTrails.invalidateCache).toHaveBeenCalledWith('trail-1');
    });
  });
});
