import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';

interface ConditionItem {
  id: string;
  condition_type: string;
  severity: string;
  description: string | null;
  reported_at: string;
}

interface ConditionsBannerProps {
  conditions: ConditionItem[];
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

export function ConditionsBanner({ conditions, onPress }: ConditionsBannerProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  if (conditions.length === 0) return null;

  const latest = conditions[0];
  const color = SEVERITY_COLORS[latest.severity] ?? SEVERITY_COLORS.info;
  const icon = SEVERITY_ICONS[latest.severity] ?? 'information-circle';
  const label = CONDITION_LABELS[latest.condition_type] ?? latest.condition_type;

  return (
    <TouchableOpacity
      style={[styles.banner, { borderLeftColor: color }]}
      onPress={onPress}
    >
      <View style={styles.row}>
        <Ionicons name={icon as any} size={20} color={color} />
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color }]}>{label}</Text>
          {latest.description && (
            <Text style={styles.description} numberOfLines={1}>
              {latest.description}
            </Text>
          )}
        </View>
        {conditions.length > 1 && (
          <Text style={styles.more}>+{conditions.length - 1} more</Text>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
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
