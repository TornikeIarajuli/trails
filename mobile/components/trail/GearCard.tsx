import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useGearStore } from '../../store/gearStore';
import type { GearPlan } from '../../utils/gear';

interface GearCardProps {
  trailId: string;
  plan: GearPlan;
  gearNotes?: string | null;
  onPress: () => void;
}

/** Trail screen teaser for the "What to bring" list. */
export function GearCard({ trailId, plan, gearNotes, onPress }: GearCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const checked = useGearStore((s) => s.ticks[trailId]?.checked);

  const keys = new Set(plan.items.map((i) => i.key));
  const packed = (checked ?? []).filter((k) => keys.has(k as never)).length;
  const essentials = plan.items.filter((i) => i.level === 'essential');
  const notes = gearNotes?.trim();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`What to bring: ${plan.items.length} items, ${packed} packed. Open the list.`}
    >
      <View style={styles.header}>
        <Ionicons name="bag-check-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.headerText}>What to bring</Text>
        <Text style={styles.progress}>
          {packed > 0 ? `${packed} of ${plan.items.length} packed` : `${plan.items.length} items`}
        </Text>
      </View>

      {notes ? (
        <View style={styles.note}>
          <Ionicons name="document-text-outline" size={14} color={Colors.warning} />
          <Text style={styles.noteText} numberOfLines={2}>
            {notes}
          </Text>
        </View>
      ) : null}

      <View style={styles.chips}>
        {essentials.slice(0, 6).map((item) => (
          <View key={item.key} style={styles.chip}>
            <Ionicons name={item.icon as never} size={13} color={Colors.primary} />
            <Text style={styles.chipText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>See the full list</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 16,
      gap: 12,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    progress: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.primary,
    },
    note: {
      flexDirection: 'row',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: Colors.warning + '14',
    },
    noteText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: Colors.text,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: Colors.text,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    footerText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
  });
