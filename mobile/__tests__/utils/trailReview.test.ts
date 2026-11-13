// The reason list lives in the moderation service; keep its HTTP client (and the app wiring it pulls in) out
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));

import { isRouteUnverified, trailReportErrorMessage } from '../../utils/trailReview';
import { TRAIL_PROBLEM_REASONS } from '../../services/moderation';

describe('isRouteUnverified', () => {
  it('flags a trail the team has not checked yet', () => {
    expect(isRouteUnverified({ reviewed_at: null })).toBe(true);
  });

  it('does not flag a checked trail', () => {
    expect(isRouteUnverified({ reviewed_at: '2026-11-13T10:00:00Z' })).toBe(false);
  });

  it('treats a trail from an older API (no reviewed_at at all) as checked', () => {
    expect(isRouteUnverified({})).toBe(false);
    expect(isRouteUnverified(null)).toBe(false);
    expect(isRouteUnverified(undefined)).toBe(false);
  });
});

describe('trailReportErrorMessage', () => {
  it('says reporting is not available when an older API rejects the report', () => {
    expect(trailReportErrorMessage({ response: { status: 404 } })).toBe("Reporting isn't available yet.");
    expect(trailReportErrorMessage({ response: { status: 400, data: { message: ['reason must be one of …'] } } })).toBe(
      "Reporting isn't available yet.",
    );
  });

  it('passes other failures through', () => {
    expect(trailReportErrorMessage({ response: { status: 429 } })).toMatch(/too many requests/i);
    expect(trailReportErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })).toMatch(/connection/i);
  });
});

describe('TRAIL_PROBLEM_REASONS', () => {
  it('offers exactly the reasons the API accepts for a trail', () => {
    expect(TRAIL_PROBLEM_REASONS.map((r) => r.key)).toEqual([
      'wrong_route',
      'path_missing',
      'wrong_info',
      'dangerous',
      'other',
    ]);
  });
});
