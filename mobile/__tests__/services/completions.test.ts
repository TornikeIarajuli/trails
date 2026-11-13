jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from '../../services/api';
import { completionsService } from '../../services/completions';

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;
const mockDelete = (api as any).delete as jest.Mock;
const ok = (data: unknown) => Promise.resolve({ data });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('completionsService.markActive', () => {
  it('calls POST /completions/active/:trailId', async () => {
    mockPost.mockResolvedValueOnce(ok(undefined));
    await completionsService.markActive('trail-42');
    expect(mockPost).toHaveBeenCalledWith('/completions/active/trail-42');
  });

  it('returns void on success', async () => {
    mockPost.mockResolvedValueOnce(ok(undefined));
    const result = await completionsService.markActive('trail-42');
    expect(result).toBeUndefined();
  });

  it('propagates a server error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(completionsService.markActive('trail-42')).rejects.toThrow('Unauthorized');
  });
});

describe('completionsService.clearActive', () => {
  it('calls DELETE /completions/active/:trailId', async () => {
    mockDelete.mockResolvedValueOnce(ok(undefined));
    await completionsService.clearActive('trail-42');
    expect(mockDelete).toHaveBeenCalledWith('/completions/active/trail-42');
  });

  it('returns void on success', async () => {
    mockDelete.mockResolvedValueOnce(ok(undefined));
    const result = await completionsService.clearActive('trail-42');
    expect(result).toBeUndefined();
  });

  it('propagates a network error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Network Error'));
    await expect(completionsService.clearActive('trail-42')).rejects.toThrow('Network Error');
  });
});

describe('completionsService.recordHike', () => {
  const payload = {
    trail_id: 'trail-42',
    elapsed_seconds: 3600,
    started_at: '2026-11-13T07:00:00.000Z',
    completed_at: '2026-11-13T08:00:00.000Z',
    distance_m: 6120,
    track: [[42.6655, 44.6146, 1_794_553_200]] as [number, number, number][],
  };

  it('calls POST /completions/record with the payload as given', async () => {
    mockPost.mockResolvedValueOnce(ok({ id: 'c1', trail_id: 'trail-42' }));
    await completionsService.recordHike(payload);
    expect(mockPost).toHaveBeenCalledWith('/completions/record', payload, expect.anything());
  });

  it('allows a waking server a full minute before giving up', async () => {
    mockPost.mockResolvedValueOnce(ok({ id: 'c1' }));
    await completionsService.recordHike({ trail_id: 'trail-42' });
    expect(mockPost.mock.calls[0][2]).toEqual({ timeout: 60_000 });
  });

  it('returns the completion with its verification result', async () => {
    const completion = {
      id: 'c1',
      trail_id: 'trail-42',
      status: 'pending',
      verified: false,
      verification: { coverage: 0.31, required_coverage: 0.6, reason: 'low_coverage' },
      new_badge_ids: [],
      already_existed: false,
    };
    mockPost.mockResolvedValueOnce(ok(completion));
    const result = await completionsService.recordHike(payload);
    expect(result).toEqual(completion);
  });

  it('propagates a server refusal', async () => {
    mockPost.mockRejectedValueOnce(new Error('Trail not found'));
    await expect(completionsService.recordHike(payload)).rejects.toThrow('Trail not found');
  });
});

describe('completionsService.getMyCompletions', () => {
  it('calls GET /completions/me', async () => {
    mockGet.mockResolvedValueOnce(ok([]));
    await completionsService.getMyCompletions();
    expect(mockGet).toHaveBeenCalledWith('/completions/me');
  });

  it('returns the completions array', async () => {
    const completions = [{ id: 'c1', trail_id: 'trail-1' }, { id: 'c2', trail_id: 'trail-2' }];
    mockGet.mockResolvedValueOnce(ok(completions));
    const result = await completionsService.getMyCompletions();
    expect(result).toEqual(completions);
  });
});
