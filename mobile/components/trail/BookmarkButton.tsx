import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useIsBookmarked, useToggleBookmark } from '../../hooks/useBookmarks';
import { useAuthStore } from '../../store/authStore';

interface BookmarkButtonProps {
  trailId: string;
  style?: ViewStyle;
}

export function BookmarkButton({ trailId, style }: BookmarkButtonProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data } = useIsBookmarked(trailId);
  const toggleBookmark = useToggleBookmark();

  if (!isAuthenticated) return null;

  const isBookmarked = data?.bookmarked ?? false;

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={() => toggleBookmark.mutate(trailId)}
      disabled={toggleBookmark.isPending}
    >
      <Ionicons
        name={isBookmarked ? 'heart' : 'heart-outline'}
        size={22}
        color={isBookmarked ? Colors.error : Colors.text}
      />
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface + 'E0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
});
