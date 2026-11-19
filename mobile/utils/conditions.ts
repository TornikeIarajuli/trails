import type { IconName } from '../components/ui/Icon';
import type { ConditionType, SeverityLevel } from '../types/community';

export interface ConditionKind {
  type: ConditionType;
  label: string;
  icon: IconName;
  /** How serious it is when reported in one tap after a hike. */
  afterHikeSeverity: SeverityLevel;
}

/** Every trail condition hikers can report, in the order the pickers show them. */
export const CONDITION_KINDS: ConditionKind[] = [
  { type: 'trail_clear', label: 'Trail clear', icon: 'checkmark-circle', afterHikeSeverity: 'info' },
  { type: 'muddy', label: 'Muddy', icon: 'water', afterHikeSeverity: 'warning' },
  { type: 'snow', label: 'Snow', icon: 'snow', afterHikeSeverity: 'warning' },
  { type: 'fallen_tree', label: 'Fallen tree', icon: 'leaf', afterHikeSeverity: 'warning' },
  { type: 'overgrown', label: 'Overgrown', icon: 'flower', afterHikeSeverity: 'warning' },
  { type: 'flooded', label: 'Flooded', icon: 'rainy', afterHikeSeverity: 'warning' },
  { type: 'water_dry', label: 'Water source dry', icon: 'droplet-off', afterHikeSeverity: 'warning' },
  { type: 'crowded', label: 'Crowded', icon: 'people', afterHikeSeverity: 'info' },
  { type: 'damaged', label: 'Damaged', icon: 'construct', afterHikeSeverity: 'warning' },
  { type: 'closed', label: 'Closed', icon: 'close-circle', afterHikeSeverity: 'danger' },
];

const BY_TYPE = new Map<string, ConditionKind>(CONDITION_KINDS.map((k) => [k.type, k]));

/** "Water source dry"; an unknown type from a newer server reads as its words ("Rock fall"). */
export function conditionLabel(conditionType: string | null | undefined): string {
  if (!conditionType) return '';
  return BY_TYPE.get(conditionType)?.label ?? conditionType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function conditionIcon(conditionType: string | null | undefined): IconName {
  return (conditionType && BY_TYPE.get(conditionType)?.icon) || 'alert-circle';
}

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
