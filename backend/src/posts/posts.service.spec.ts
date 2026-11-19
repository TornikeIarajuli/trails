import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { SupabaseService } from '../config/supabase.config';

type Builder = Record<string, jest.Mock> & { then: unknown };

function makeBuilder(result: object): Builder {
  const self = {} as Builder;
  ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle'].forEach(
    (m) => {
      self[m] = jest.fn(() => self);
    },
  );
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

const mockAdmin = {
  from: jest.fn((table: string) => {
    const next = queues.get(table)?.shift();
    if (!next) throw new Error(`Unexpected query on ${table}`);
    return next;
  }),
  rpc: jest.fn(),
};

const TRAIL = 'a0000000-0000-0000-0000-000000000001';
const feedItem = (id: string) => ({
  activity_id: id,
  activity_type: 'post',
  user_id: 'me',
  trail_id: null,
  extra_text: 'Snow above 2,500 m',
});

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: SupabaseService, useValue: { getAdminClient: () => mockAdmin } },
      ],
    }).compile();
    service = module.get(PostsService);
    jest.clearAllMocks();
    queues.clear();
    mockAdmin.rpc.mockImplementation((_name: string, args: { p_activity_id: string }) =>
      Promise.resolve({ data: [feedItem(args.p_activity_id)], error: null }),
    );
  });

  describe('create', () => {
    it('writes the post and returns it as the feed shows it', async () => {
      onTable('trails', { data: { id: TRAIL }, error: null });
      const posts = onTable('posts', { data: { id: 'p1' }, error: null });

      const result = await service.create('me', {
        body: 'Snow above 2,500 m',
        trail_id: TRAIL,
        place_name: 'Juta',
        photo_urls: ['https://x.supabase.co/storage/v1/object/public/trail-media/posts/me/1.jpg'],
      });

      expect(posts.insert).toHaveBeenCalledWith({
        user_id: 'me',
        body: 'Snow above 2,500 m',
        trail_id: TRAIL,
        place_name: 'Juta',
        photo_urls: ['https://x.supabase.co/storage/v1/object/public/trail-media/posts/me/1.jpg'],
      });
      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_activity_item', { p_activity_id: 'p1' });
      expect(result).toEqual(feedItem('p1'));
    });

    it('takes a photo without text, or text without a trail', async () => {
      onTable('posts', { data: { id: 'p2' }, error: null });
      await service.create('me', { photo_urls: ['https://x/1.jpg'] });
      const posts = onTable('posts', { data: { id: 'p3' }, error: null });
      await service.create('me', { body: 'Hello' });
      expect(posts.insert).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Hello', trail_id: null, place_name: null, photo_urls: [] }),
      );
    });

    it('refuses an empty post', async () => {
      await expect(service.create('me', { body: '' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('me', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a trail that does not exist', async () => {
      onTable('trails', { data: null, error: null });
      await expect(service.create('me', { body: 'Hi', trail_id: TRAIL })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('changes only what was sent, on your own post', async () => {
      onTable('posts', { data: { id: 'p1', user_id: 'me', body: 'Old', photo_urls: [] }, error: null });
      const update = onTable('posts', { error: null });

      await service.update('me', 'p1', { body: 'New text', place_name: null });

      const changes = update.update.mock.calls[0][0];
      expect(changes).toEqual(expect.objectContaining({ body: 'New text', place_name: null }));
      expect(changes).not.toHaveProperty('trail_id');
      expect(changes).not.toHaveProperty('photo_urls');
      expect(update.eq).toHaveBeenCalledWith('id', 'p1');
    });

    it("refuses someone else's post, and one that is gone", async () => {
      onTable('posts', { data: { id: 'p1', user_id: 'other', body: 'Hi', photo_urls: [] }, error: null });
      await expect(service.update('me', 'p1', { body: 'Mine now' })).rejects.toBeInstanceOf(ForbiddenException);
      onTable('posts', { data: null, error: null });
      await expect(service.update('me', 'gone', { body: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to empty a post', async () => {
      onTable('posts', { data: { id: 'p1', user_id: 'me', body: 'Hi', photo_urls: [] }, error: null });
      await expect(service.update('me', 'p1', { body: '' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes your own post with its likes, comments and saves', async () => {
      onTable('posts', { data: { id: 'p1', user_id: 'me', body: 'Hi', photo_urls: [] }, error: null });
      const post = onTable('posts', { error: null });
      const likes = onTable('activity_likes', { error: null });
      const comments = onTable('activity_comments', { error: null });
      const saved = onTable('saved_posts', { error: null });

      await expect(service.remove('me', 'p1')).resolves.toEqual({ deleted: true });
      expect(post.delete).toHaveBeenCalled();
      for (const b of [likes, comments, saved]) expect(b.eq).toHaveBeenCalledWith('activity_id', 'p1');
    });

    it("refuses someone else's post", async () => {
      onTable('posts', { data: { id: 'p1', user_id: 'other', body: 'Hi', photo_urls: [] }, error: null });
      await expect(service.remove('me', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
