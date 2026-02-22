import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyCompletions, useDeleteCompletion } from '../../hooks/useCompletions';
import { DifficultyBadge } from '../trail/DifficultyBadge';
import { TrailDifficulty } from '../../types/trail';
import { formatDate } from '../../utils/formatters';

export function CompletionsSection() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: completions } = useMyCompletions();
  const deleteCompletion = useDeleteCompletion();

  if (!completions || completions.length === 0) return null;

  const handleDelete = (id: string, trailName: string) => {
    Alert.alert(
      'Delete Completion',
      `Remove "${trailName}" from your history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCompletion.mutate(id) },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Completed Trails</Text>
      {completions.map((c) => (
        <View key={c.id} style={styles.row}>
          <TouchableOpacity
            style={styles.rowTouchable}
            onPress={() => router.push(`/trail/completion/${c.id}`)}
          >
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {c.trails?.name_en ?? 'Unknown Trail'}
              </Text>
              <Text style={styles.sub}>{formatDate(c.completed_at)}</Text>
            </View>
            {c.trails?.difficulty && (
              <DifficultyBadge difficulty={c.trails.difficulty as TrailDifficulty} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(c.id, c.trails?.name_en ?? 'this trail')}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowTouchable: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  deleteButton: {
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  sub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
