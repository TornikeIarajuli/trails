import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { ActionSheet } from '../ui/ActionSheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyCompletions, useDeleteCompletion } from '../../hooks/useCompletions';
import { DifficultyBadge } from '../trail/DifficultyBadge';
import { TrailDifficulty } from '../../types/trail';
import type { TrailCompletion as Completion } from '../../types/completion';
import { completionDateLabel, isPastHike } from '../../utils/pastHikes';

/** The own profile's Hikes tab: completed trails, newest first, each with a menu to remove it. */
export function CompletionsSection() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: completions, isLoading } = useMyCompletions();
  const deleteCompletion = useDeleteCompletion();
  const [menuFor, setMenuFor] = useState<Completion | null>(null);
  const [confirmFor, setConfirmFor] = useState<Completion | null>(null);

  if (isLoading && !completions) return null;

  if (!completions || completions.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="footsteps-outline" size={28} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>No hikes yet</Text>
        <Text style={styles.emptyText}>
          Record a hike from any trail, or open a trail you hiked before and tap "Mark as done".
        </Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => router.navigate('/(tabs)/home')} accessibilityRole="button">
          <Text style={styles.emptyButtonText}>Explore trails</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nameOf = (c: Completion) => c.trails?.name_en ?? 'this trail';

  return (
    <View style={styles.list}>
      {completions.map((c) => (
        <View key={c.id} style={styles.row}>
          <TouchableOpacity
            style={styles.rowMain}
            onPress={() => router.push(`/trail/completion/${c.id}`)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {c.trails?.name_en ?? 'Unknown trail'}
              </Text>
              <Text style={styles.sub}>{completionDateLabel(c)}</Text>
            </View>
            {c.trails?.difficulty && <DifficultyBadge difficulty={c.trails.difficulty as TrailDifficulty} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuFor(c)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`More options for ${nameOf(c)}`}
          >
            <Icon name="ellipsis-vertical" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      ))}

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor ? nameOf(menuFor) : undefined}
        options={[
          { key: 'trail', label: 'Open trail', icon: 'map-outline' },
          { key: 'remove', label: menuFor && isPastHike(menuFor) ? 'Remove past hike' : 'Remove from my trails', icon: 'trash-outline', destructive: true },
        ]}
        closeOnSelect
        onSelect={(key) => {
          const c = menuFor;
          if (!c) return;
          if (key === 'trail' && c.trail_id) router.push(`/trail/${c.trail_id}`);
          if (key === 'remove') setConfirmFor(c);
        }}
        onClose={() => setMenuFor(null)}
      />

      <ActionSheet
        visible={confirmFor !== null}
        title={confirmFor && isPastHike(confirmFor) ? 'Remove this past hike?' : 'Remove this hike?'}
        message={
          confirmFor && isPastHike(confirmFor)
            ? `"${nameOf(confirmFor)}" leaves your completed trails. You can mark it as done again later.`
            : confirmFor
              ? `"${nameOf(confirmFor)}" leaves your history, and its badges and counts are recalculated.`
              : undefined
        }
        options={[{ key: 'confirm', label: 'Remove', icon: 'trash-outline', destructive: true }]}
        closeOnSelect
        onSelect={() => {
          if (confirmFor) deleteCompletion.mutate(confirmFor.id);
        }}
        onClose={() => setConfirmFor(null)}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: 16,
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingLeft: 14,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    sub: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    menuButton: {
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    empty: {
      marginHorizontal: 16,
      padding: 24,
      gap: 8,
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      marginTop: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: Colors.primary,
    },
    emptyButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
  });
