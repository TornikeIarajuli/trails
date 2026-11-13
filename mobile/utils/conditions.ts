const SEVERITY_RANK: Record<string, number> = {
  danger: 3,
  warning: 2,
  info: 1,
};

interface RankableCondition {
  severity: string;
  reported_at: string;
}

function reportedTime(condition: RankableCondition): number {
  const time = new Date(condition.reported_at).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * The report a hiker most needs to see first: highest severity
 * (danger > warning > info), newest first within the same severity.
 * A fresh "trail clear" must never hide an older "closed".
 */
export function sortConditionsBySeverity<T extends RankableCondition>(conditions: T[]): T[] {
  return [...conditions].sort((a, b) => {
    const bySeverity = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    return bySeverity !== 0 ? bySeverity : reportedTime(b) - reportedTime(a);
  });
}

export function pickMostSevereCondition<T extends RankableCondition>(conditions: T[]): T | null {
  return sortConditionsBySeverity(conditions)[0] ?? null;
}
