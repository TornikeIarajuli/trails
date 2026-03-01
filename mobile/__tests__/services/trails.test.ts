/**
 * trailsService unit tests
 *
 * The Axios instance (services/api.ts) is replaced wholesale with a manual
 * mock so that no network calls, auth interceptors, or AsyncStorage reads
 * are triggered during tests.
 */

// ---------------------------------------------------------------------------
// Mock services/api
// jest.mock is hoisted above const declarations, so we reference the mocks
// through the imported module object AFTER the mock is set up.
// ---------------------------------------------------------------------------
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from '../../services/api';
import { trailsService } from '../../services/trails';

const mockGet = api.get as jest.Mock;
const mockPatch = api.patch as jest.Mock;
const mockDelete = (api as any).delete as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ok = (data: unknown) => Promise.resolve({ data });

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getTrails
// ---------------------------------------------------------------------------
describe('trailsService.getTrails', () => {
  it('calls GET /trails with no params when called with no arguments', async () => {
    mockGet.mockResolvedValueOnce(ok({ data: [], pagination: {} }));
    await trailsService.getTrails();
    expect(mockGet).toHaveBeenCalledWith('/trails', { params: undefined });
  });

  it('forwards all filter params to GET /trails', async () => {
    mockGet.mockResolvedValueOnce(ok({ data: [], pagination: {} }));
    const params = { difficulty: 'hard', region: 'Kazbegi', search: 'peak', page: 2, limit: 10 };
    await trailsService.getTrails(params);
    expect(mockGet).toHaveBeenCalledWith('/trails', { params });
  });

  it('returns the full paginated response from the server', async () => {
    const payload = {
      data: [{ id: 'trail-1', name_en: 'Kazbegi Loop' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    mockGet.mockResolvedValueOnce(ok(payload));
    const result = await trailsService.getTrails();
    expect(result).toEqual(payload);
  });

  it('propagates a network error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));
    await expect(trailsService.getTrails()).rejects.toThrow('Network Error');
  });
});

// ---------------------------------------------------------------------------
// getTrail
// ---------------------------------------------------------------------------
describe('trailsService.getTrail', () => {
  it('calls GET /trails/:id', async () => {
    mockGet.mockResolvedValueOnce(ok({ id: 'trail-42' }));
    await trailsService.getTrail('trail-42');
    expect(mockGet).toHaveBeenCalledWith('/trails/trail-42');
  });

  it('returns the trail detail object', async () => {
    const detail = {
      id: 'trail-42',
      name_en: 'Ridge Walk',
      checkpoints: [{ id: 'cp-1', name: 'Summit' }],
      avg_rating: 4.5,
    };
    mockGet.mockResolvedValueOnce(ok(detail));
    const result = await trailsService.getTrail('trail-42');
    expect(result).toEqual(detail);
  });

  it('propagates a 404 error for an unknown id', async () => {
    const error = Object.assign(new Error('Not Found'), { response: { status: 404 } });
    mockGet.mockRejectedValueOnce(error);
    await expect(trailsService.getTrail('bad-id')).rejects.toThrow('Not Found');
  });
});

// ---------------------------------------------------------------------------
// getNearby
// ---------------------------------------------------------------------------
describe('trailsService.getNearby', () => {
  it('calls GET /trails/nearby with lat, lng, and radius_km', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    await trailsService.getNearby(41.69, 44.83, 25);
    expect(mockGet).toHaveBeenCalledWith('/trails/nearby', {
      params: { lat: 41.69, lng: 44.83, radius_km: 25 },
    });
  });

  it('passes radius_km as undefined when not supplied', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    await trailsService.getNearby(41.69, 44.83);
    expect(mockGet).toHaveBeenCalledWith('/trails/nearby', {
      params: { lat: 41.69, lng: 44.83, radius_km: undefined },
    });
  });

  it('returns the array of nearby trails', async () => {
    const nearby = [
      { id: 'n1', name_en: 'Close Peak', distance_from_user_m: 320 },
      { id: 'n2', name_en: 'Far Ridge', distance_from_user_m: 8500 },
    ];
    mockGet.mockResolvedValueOnce(ok(nearby));
    const result = await trailsService.getNearby(41.0, 44.0, 10);
    expect(result).toEqual(nearby);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array when no trails are within range', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    const result = await trailsService.getNearby(0, 0, 1);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getRegions
// ---------------------------------------------------------------------------
describe('trailsService.getRegions', () => {
  it('calls GET /trails/regions', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    await trailsService.getRegions();
    expect(mockGet).toHaveBeenCalledWith('/trails/regions');
  });

  it('returns the array of region strings', async () => {
    const regions = ['Kazbegi', 'Racha', 'Svaneti'];
    mockGet.mockResolvedValueOnce(ok(regions));
    const result = await trailsService.getRegions();
    expect(result).toEqual(regions);
  });

  it('returns an empty array when no regions exist', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    expect(await trailsService.getRegions()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateTrail
// ---------------------------------------------------------------------------
describe('trailsService.updateTrail', () => {
  it('calls PATCH /trails/:id with the provided update payload', async () => {
    const update = { name_en: 'New Name', is_published: true };
    mockPatch.mockResolvedValueOnce(ok({ id: '1', ...update }));
    await trailsService.updateTrail('1', update);
    expect(mockPatch).toHaveBeenCalledWith('/trails/1', update);
  });

  it('returns the updated trail', async () => {
    const trail = { id: '1', name_en: 'Updated Name', difficulty: 'medium' };
    mockPatch.mockResolvedValueOnce(ok(trail));
    const result = await trailsService.updateTrail('1', { name_en: 'Updated Name' });
    expect(result).toEqual(trail);
  });

  it('interpolates the trail id into the URL path', async () => {
    mockPatch.mockResolvedValueOnce(ok({}));
    await trailsService.updateTrail('trail-999', { difficulty: 'easy' });
    expect(mockPatch).toHaveBeenCalledWith('/trails/trail-999', expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// deleteTrailMedia
// ---------------------------------------------------------------------------
describe('trailsService.deleteTrailMedia', () => {
  it('calls DELETE /media/:mediaId', async () => {
    mockDelete.mockResolvedValueOnce(ok(undefined));
    await trailsService.deleteTrailMedia('media-abc');
    expect(mockDelete).toHaveBeenCalledWith('/media/media-abc');
  });

  it('does not return a value (void)', async () => {
    mockDelete.mockResolvedValueOnce(ok(undefined));
    const result = await trailsService.deleteTrailMedia('media-1');
    expect(result).toBeUndefined();
  });

  it('propagates a deletion error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(trailsService.deleteTrailMedia('media-1')).rejects.toThrow('Forbidden');
  });
});
