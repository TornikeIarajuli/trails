import { describeCompletionOutcome, describeReason, parseAutoReviewNote } from '../../utils/verification';

describe('parseAutoReviewNote', () => {
  it('reads the reason and coverage the server stores for an unverified hike', () => {
    expect(parseAutoReviewNote('auto: low_coverage (42%)')).toEqual({ reason: 'low_coverage', coveragePercent: 42 });
    expect(parseAutoReviewNote('auto: no_track (0%)')).toEqual({ reason: 'no_track', coveragePercent: 0 });
    expect(parseAutoReviewNote('auto: too_fast')).toEqual({ reason: 'too_fast', coveragePercent: null });
  });

  it('ignores notes written by a person', () => {
    expect(parseAutoReviewNote('Photo does not show the summit')).toBeNull();
    expect(parseAutoReviewNote('auto: something_else (10%)')).toBeNull();
    expect(parseAutoReviewNote(null)).toBeNull();
    expect(parseAutoReviewNote(undefined)).toBeNull();
  });
});

describe('describeReason', () => {
  it('explains each reason in plain words', () => {
    expect(describeReason('no_track')).toMatch(/No GPS track/);
    expect(describeReason('too_fast')).toMatch(/faster than is possible on foot/);
    expect(describeReason('no_route')).toMatch(/no mapped route/);
    expect(describeReason('low_coverage')).toBe('The recorded GPS track covers too little of the trail.');
  });

  it('adds the numbers for low coverage when they are known', () => {
    expect(describeReason('low_coverage', 42.4, 60)).toBe(
      'The recorded GPS track covers too little of the trail (42%, 60% is needed).',
    );
    expect(describeReason('low_coverage', 42.4)).toBe('The recorded GPS track covers too little of the trail (42%).');
  });

  it('has a neutral sentence when the reason is unknown', () => {
    expect(describeReason(null)).toBe('This hike has not been verified yet.');
  });
});

describe('describeCompletionOutcome', () => {
  it('an approved completion is verified', () => {
    expect(describeCompletionOutcome({ status: 'approved', reviewerNote: null })).toEqual({
      state: 'verified',
      title: 'Verified',
      detail: null,
    });
  });

  it('a pending completion is recorded but not verified, with the stored reason', () => {
    const outcome = describeCompletionOutcome({ status: 'pending', reviewerNote: 'auto: low_coverage (31%)' });
    expect(outcome.state).toBe('unverified');
    expect(outcome.title).toBe('Recorded, not verified');
    expect(outcome.detail).toMatch(/covers too little of the trail \(31%\)/);
    expect(outcome.detail).toMatch(/does not count toward your badges or the leaderboard/);
  });

  it('prefers what the server just reported over the stored note', () => {
    const outcome = describeCompletionOutcome({
      status: 'pending',
      reviewerNote: 'auto: low_coverage (31%)',
      recorded: { verified: false, reason: 'low_coverage', coverage: 0.314, requiredCoverage: 0.6 },
    });
    expect(outcome.detail).toMatch(/\(31%, 60% is needed\)/);
  });

  it('uses the result of the upload while the completion itself is unknown', () => {
    expect(describeCompletionOutcome({ recorded: { verified: false, reason: 'no_track' } }).state).toBe('unverified');
    expect(describeCompletionOutcome({ recorded: { verified: true, reason: 'ok' } }).state).toBe('verified');
  });

  it('the stored status wins once an admin has approved the hike', () => {
    const outcome = describeCompletionOutcome({
      status: 'approved',
      reviewerNote: 'auto: low_coverage (31%)',
      recorded: { verified: false, reason: 'low_coverage' },
    });
    expect(outcome.state).toBe('verified');
  });

  it('a pending completion without any reason is simply not verified yet', () => {
    const outcome = describeCompletionOutcome({ status: 'pending', reviewerNote: null });
    expect(outcome.state).toBe('unverified');
    expect(outcome.detail).toMatch(/^This hike has not been verified yet\./);
  });

  it('a rejected completion shows the reviewer’s own words', () => {
    expect(describeCompletionOutcome({ status: 'rejected', reviewerNote: 'Wrong trail' })).toEqual({
      state: 'rejected',
      title: 'Not approved',
      detail: 'Wrong trail',
    });
    expect(describeCompletionOutcome({ status: 'rejected', reviewerNote: 'auto: no_track (0%)' }).detail).toMatch(
      /did not approve/,
    );
  });
});
