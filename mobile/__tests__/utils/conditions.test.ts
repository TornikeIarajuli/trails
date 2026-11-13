import { pickMostSevereCondition, sortConditionsBySeverity } from '../../utils/conditions';

const report = (id: string, severity: string, reported_at: string) => ({ id, severity, reported_at });

describe('pickMostSevereCondition', () => {
  it('returns null when there are no reports', () => {
    expect(pickMostSevereCondition([])).toBeNull();
  });

  it('prefers an older "danger" report over a newer "info" one', () => {
    const conditions = [
      report('clear', 'info', '2026-11-12T10:00:00Z'),
      report('closed', 'danger', '2026-11-10T10:00:00Z'),
    ];
    expect(pickMostSevereCondition(conditions)?.id).toBe('closed');
  });

  it('orders danger > warning > info', () => {
    const conditions = [
      report('info', 'info', '2026-11-12T10:00:00Z'),
      report('warning', 'warning', '2026-11-11T10:00:00Z'),
      report('danger', 'danger', '2026-11-01T10:00:00Z'),
    ];
    expect(sortConditionsBySeverity(conditions).map((c) => c.id)).toEqual(['danger', 'warning', 'info']);
  });

  it('shows the newest first within the same severity', () => {
    const conditions = [
      report('old', 'warning', '2026-11-01T10:00:00Z'),
      report('new', 'warning', '2026-11-12T10:00:00Z'),
    ];
    expect(pickMostSevereCondition(conditions)?.id).toBe('new');
  });

  it('ranks unknown severities last and does not mutate its input', () => {
    const conditions = [
      report('odd', 'unknown', '2026-11-12T10:00:00Z'),
      report('info', 'info', '2026-11-01T10:00:00Z'),
    ];
    const copy = [...conditions];
    expect(sortConditionsBySeverity(conditions).map((c) => c.id)).toEqual(['info', 'odd']);
    expect(conditions).toEqual(copy);
  });
});
