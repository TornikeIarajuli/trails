jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import api from '../../services/api';
import {
  describeImageUpload,
  encodeCaption,
  getUploadErrorMessage,
  mediaService,
} from '../../services/media';

const mockPost = api.post as jest.Mock;
const blob = { size: 3 };

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) });
  mockPost.mockResolvedValue({ data: { id: 'p1', url: 'https://x/p1.webp' } });
});

describe('describeImageUpload', () => {
  it('uses the extension of the picked file', () => {
    expect(describeImageUpload({ uri: 'file:///a/IMG_0001.HEIC' })).toEqual({ fileName: 'photo.heic', mimeType: 'image/heic' });
    expect(describeImageUpload({ uri: 'file:///x', fileName: 'Mtskheta trip.png' })).toEqual({
      fileName: 'photo.png',
      mimeType: 'image/png',
    });
  });

  it('falls back to the MIME type and then to JPEG', () => {
    expect(describeImageUpload({ uri: 'content://media/42', mimeType: 'image/webp' })).toEqual({
      fileName: 'photo.webp',
      mimeType: 'image/webp',
    });
    expect(describeImageUpload({ uri: 'content://media/42' })).toEqual({ fileName: 'photo.jpg', mimeType: 'image/jpeg' });
  });
});

describe('encodeCaption', () => {
  it('URI-encodes UTF-8 text so it is safe in a header', () => {
    expect(encodeCaption('ყაზბეგი · view')).toBe(encodeURIComponent('ყაზბეგი · view'));
  });

  it('trims and caps the caption at 300 characters', () => {
    expect(decodeURIComponent(encodeCaption(`  ${'a'.repeat(400)}  `))).toHaveLength(300);
  });
});

describe('getUploadErrorMessage', () => {
  it('explains the size and type limits', () => {
    expect(getUploadErrorMessage({ response: { status: 413 } })).toMatch(/12 MB/);
    expect(getUploadErrorMessage({ response: { status: 415 } })).toMatch(/not supported/);
  });
});

describe('mediaService uploads', () => {
  it('uploads a community photo once, with its own long timeout and an encoded caption', async () => {
    await mediaService.uploadHikePhoto('t1', 'file:///a/b.jpg', 'b.jpg', 'image/jpeg', 'Summit — თოვლი');

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/media/hike-photo/t1');
    expect(body).toBe(blob);
    expect(config.timeout).toBe(120_000);
    expect(config.headers).toMatchObject({
      'Content-Type': 'image/jpeg',
      'x-file-name': 'b.jpg',
      'x-media-type': 'photo',
      'x-caption': encodeURIComponent('Summit — თოვლი'),
    });
  });

  it('omits the caption header when there is no caption', async () => {
    await mediaService.uploadHikePhoto('t1', 'file:///a/b.jpg', 'b.jpg', 'image/jpeg');
    expect(mockPost.mock.calls[0][2].headers['x-caption']).toBeUndefined();
  });

  it('sends admin trail photos to the trail media endpoint', async () => {
    await mediaService.uploadTrailMedia('t9', 'file:///a/c.png', 'c.png', 'image/png');
    expect(mockPost.mock.calls[0][0]).toBe('/media/trail/t9');
    expect(mockPost.mock.calls[0][2].headers['x-media-type']).toBe('photo');
  });

  it('keeps the file-name header ASCII', async () => {
    await mediaService.uploadAvatar('file:///a/ფოტო 1.jpg', 'ფოტო 1.jpg', 'image/jpeg');
    expect(mockPost.mock.calls[0][2].headers['x-file-name']).toMatch(/^[A-Za-z0-9_-]+\.jpg$/);
  });
});
