import React, { useMemo, useState } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useIsBookmarked, useToggleBookmark, useUpdateBookmark } from '../../hooks/useBookmarks';
import { useAuthStore } from '../../store/authStore';
import { BookmarkCategory, CATEGORY_ICONS, CATEGORY_LABELS } from '../../services/bookmarks';
import { ActionSheet, ActionSheetOption } from '../ui/ActionSheet';
import { haptics } from '../../utils/haptics';

const CATEGORY_ORDER: BookmarkCategory[] = ['saved', 'want_to_hike', 'in_progress', 'favorites'];

interface BookmarkButtonProps {
  trailId: string;
  style?: ViewStyle;
}

/** Tap to save or unsave the trail; long-press to choose which list it goes in. */
export function BookmarkButton({ trailId, style }: BookmarkButtonProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data } = useIsBookmarked(isAuthenticated ? trailId : '');
  const toggleBookmark = useToggleBookmark();
  const updateBookmark = useUpdateBookmark();
  const [showCategories, setShowCategories] = useState(false);

  if (!isAuthenticated) return null;

  const isBookmarked = data?.bookmarked ?? false;
  const currentCategory = data?.category ?? null;
  const busy = toggleBookmark.isPending || updateBookmark.isPending;

  const chooseCategory = (key: string) => {
    setShowCategories(false);
    if (key === 'remove') {
      if (isBookmarked) toggleBookmark.mutate({ trailId });
      return;
    }
    const category = key as BookmarkCategory;
    if (isBookmarked) {
      if (category !== currentCategory) updateBookmark.mutate({ trailId, data: { category } });
    } else {
      toggleBookmark.mutate({ trailId, category });
    }
  };

  const options: ActionSheetOption[] = CATEGORY_ORDER.map((category) => ({
    key: category,
    label: CATEGORY_LABELS[category],
    icon: CATEGORY_ICONS[category] as React.ComponentProps<typeof Ionicons>['name'],
    selected: isBookmarked && currentCategory === category,
  }));
  if (isBookmarked) {
    options.push({ key: 'remove', label: 'Remove bookmark', icon: 'trash-outline', destructive: true });
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={() =>
          toggleBookmark.mutate(
            { trailId },
            { onSuccess: (result) => (result?.bookmarked ? haptics.success() : haptics.tap()) },
          )
        }
        onLongPress={() => setShowCategories(true)}
        disabled={busy}
        accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark trail'}
        accessibilityHint="Long press to choose a list"
        accessibilityRole="button"
        accessibilityActions={[{ name: 'longpress', label: 'Choose a list' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') setShowCategories(true);
        }}
      >
        <Ionicons
          name={isBookmarked ? 'heart' : 'heart-outline'}
          size={22}
          color={isBookmarked ? Colors.error : Colors.text}
        />
      </TouchableOpacity>

      {showCategories && (
        <ActionSheet
          visible
          title={isBookmarked ? 'Move to list' : 'Save to list'}
          options={options}
          onSelect={chooseCategory}
          closeOnSelect
          onClose={() => setShowCategories(false)}
        />
      )}
    </>
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
