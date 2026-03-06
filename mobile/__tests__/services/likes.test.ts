jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import api from '../../services/api';
import { likesService } from '../../services/likes';

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;
const ok = (data: unknown) => Promise.resolve({ data });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('likesService.getLikes', () => {
  it('calls GET /comments/likes/:activityId', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    await likesService.getLikes('activity-1');
    expect(mockGet).toHaveBeenCalledWith('/comments/likes/activity-1');
  });

  it('returns the array of likes', async () => {
    const likes = [
      { id: 'like-1', user_id: 'user-a', created_at: '2024-01-01T00:00:00Z' },
      { id: 'like-2', user_id: 'user-b', created_at: '2024-01-02T00:00:00Z' },
    ];
    mockGet.mockResolvedValueOnce(ok(likes));
    const result = await likesService.getLikes('activity-1');
    expect(result).toEqual(likes);
  });

  it('returns an empty array when there are no likes', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    expect(await likesService.getLikes('activity-1')).toEqual([]);
  });
});

describe('likesService.toggleLike', () => {
  it('calls POST /comments/likes/toggle with activity_id and activity_type', async () => {
    mockPost.mockResolvedValueOnce(ok({ liked: true, count: 3 }));
    await likesService.toggleLike({ activity_id: 'act-1', activity_type: 'hike' });
    expect(mockPost).toHaveBeenCalledWith('/comments/likes/toggle', {
      activity_id: 'act-1',
      activity_type: 'hike',
    });
  });

  it('returns liked=true and updated count when liking', async () => {
    mockPost.mockResolvedValueOnce(ok({ liked: true, count: 5 }));
    const result = await likesService.toggleLike({ activity_id: 'act-2', activity_type: 'hike' });
    expect(result).toEqual({ liked: true, count: 5 });
  });

  it('returns liked=false and updated count when unliking', async () => {
    mockPost.mockResolvedValueOnce(ok({ liked: false, count: 4 }));
    const result = await likesService.toggleLike({ activity_id: 'act-2', activity_type: 'hike' });
    expect(result).toEqual({ liked: false, count: 4 });
  });

  it('propagates a network error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network Error'));
    await expect(
      likesService.toggleLike({ activity_id: 'act-1', activity_type: 'hike' }),
    ).rejects.toThrow('Network Error');
  });
});
