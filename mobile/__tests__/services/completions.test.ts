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
  it('calls POST /completions/record with trail_id and elapsed_seconds', async () => {
    mockPost.mockResolvedValueOnce(ok({ id: 'c1', trail_id: 'trail-42' }));
    await completionsService.recordHike('trail-42', 3600);
    expect(mockPost).toHaveBeenCalledWith('/completions/record', {
      trail_id: 'trail-42',
      elapsed_seconds: 3600,
    });
  });

  it('omits elapsed_seconds when not provided', async () => {
    mockPost.mockResolvedValueOnce(ok({ id: 'c1', trail_id: 'trail-42' }));
    await completionsService.recordHike('trail-42');
    expect(mockPost).toHaveBeenCalledWith('/completions/record', {
      trail_id: 'trail-42',
      elapsed_seconds: undefined,
    });
  });

  it('returns the completion object', async () => {
    const completion = { id: 'c1', trail_id: 'trail-42', elapsed_seconds: 3600 };
    mockPost.mockResolvedValueOnce(ok(completion));
    const result = await completionsService.recordHike('trail-42', 3600);
    expect(result).toEqual(completion);
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
