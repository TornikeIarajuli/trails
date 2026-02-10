import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { TrailDifficulty } from '../../types/trail';

interface DifficultyBadgeProps {
  difficulty: TrailDifficulty;
  size?: 'sm' | 'md';
}

export function DifficultyBadge({ difficulty, size = 'sm' }: DifficultyBadgeProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const color = Colors.difficulty[difficulty];

  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }, size === 'md' && styles.md]}>
      <Text style={[styles.text, { color }, size === 'md' && styles.mdText]}>
        {difficulty.toUpperCase()}
      </Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mdText: {
    fontSize: 13,
  },
});
