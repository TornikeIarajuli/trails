import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { pickMostSevereCondition } from '../../utils/conditions';

interface ConditionItem {
  id: string;
  condition_type: string;
  severity: string;
  description: string | null;
  reported_at: string;
}

interface ConditionsBannerProps {
  conditions: ConditionItem[];
  /** Number of active reports in total, when `conditions` is only a sample of them. */
  totalCount?: number;
  onPress: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: '#2196F3',
  warning: '#FF9800',
  danger: '#F44336',
};

const SEVERITY_ICONS: Record<string, string> = {
  info: 'information-circle',
  warning: 'warning',
  danger: 'alert-circle',
};

const CONDITION_LABELS: Record<string, string> = {
  trail_clear: 'Trail Clear',
  muddy: 'Muddy',
  snow: 'Snow',
  fallen_tree: 'Fallen Tree',
  flooded: 'Flooded',
  overgrown: 'Overgrown',
  damaged: 'Damaged',
  closed: 'Closed',
};

export function ConditionsBanner({ conditions, totalCount, onPress }: ConditionsBannerProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  // The most severe report leads: a fresh "trail clear" must not hide an older "closed"
  const top = pickMostSevereCondition(conditions);
  if (!top) return null;

  const others = Math.max((totalCount ?? conditions.length) - 1, 0);
  const color = SEVERITY_COLORS[top.severity] ?? SEVERITY_COLORS.info;
  const icon = SEVERITY_ICONS[top.severity] ?? 'information-circle';
  const label = CONDITION_LABELS[top.condition_type] ?? top.condition_type;

  return (
    <TouchableOpacity
      style={[styles.banner, { borderLeftColor: color }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Trail condition: ${label}${
        others > 0 ? `, and ${others} more report${others === 1 ? '' : 's'}` : ''
      }. View all reports`}
    >
      <View style={styles.row}>
        <Icon name={icon as any} size={20} color={color} />
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color }]}>{label}</Text>
          {top.description && (
            <Text style={styles.description} numberOfLines={1}>
              {top.description}
            </Text>
          )}
        </View>
        {others > 0 && (
          <Text style={styles.more}>+{others} more</Text>
        )}
        <Icon name="chevron-forward" size={16} color={Colors.textLight} />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  more: {
    fontSize: 12,
    color: Colors.textLight,
  },
});
