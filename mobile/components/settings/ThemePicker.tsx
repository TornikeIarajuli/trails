import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { AUTO_THEMES, THEMES, THEME_ORDER, ThemeChoice, ThemeId } from '../../constants/themes';
import { useSettingsStore } from '../../store/settingsStore';
import { haptics } from '../../utils/haptics';

type Styles = ReturnType<typeof createStyles>;

/** A thumbnail of a theme: its background, a surface card with two lines of text, a primary pill. */
function ThemePreview({ id, style }: { id: ThemeId; style?: object }) {
  const c = THEMES[id].colors;
  return (
    <View style={[previewStyles.frame, { backgroundColor: c.background }, style]}>
      <View style={[previewStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[previewStyles.line, { backgroundColor: c.text, width: '72%' }]} />
        <View style={[previewStyles.line, previewStyles.lineThin, { backgroundColor: c.textSecondary, width: '48%' }]} />
        <View style={[previewStyles.pill, { backgroundColor: c.primary }]}>
          <View style={[previewStyles.pillText, { backgroundColor: c.textOnPrimary }]} />
        </View>
      </View>
    </View>
  );
}

function Check({ selected, Colors }: { selected: boolean; Colors: ColorPalette }) {
  return selected ? (
    <Icon name="checkmark-circle" size={18} color={Colors.primary} />
  ) : (
    <View style={{ width: 18, height: 18 }} />
  );
}

function ThemeCard({
  id,
  selected,
  onPress,
  styles,
  Colors,
}: {
  id: ThemeId;
  selected: boolean;
  onPress: () => void;
  styles: Styles;
  Colors: ColorPalette;
}) {
  const theme = THEMES[id];
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${theme.name} theme${theme.dark ? ', dark' : ''}`}
      testID={`theme-${id}`}
    >
      <ThemePreview id={id} />
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{theme.name}</Text>
        <Check selected={selected} Colors={Colors} />
      </View>
    </TouchableOpacity>
  );
}

/** Settings → Appearance: the colour themes, applied as soon as one is picked. */
export function ThemePicker() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const choice = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const choose = (next: ThemeChoice) => {
    if (next === choice) return;
    haptics.select();
    setTheme(next);
  };

  const autoSelected = choice === 'auto';

  return (
    <View accessibilityRole="radiogroup">
      <TouchableOpacity
        style={[styles.autoRow, autoSelected && styles.cardSelected]}
        onPress={() => choose('auto')}
        activeOpacity={0.8}
        accessibilityRole="radio"
        accessibilityState={{ checked: autoSelected }}
        accessibilityLabel={`Automatic: ${THEMES[AUTO_THEMES.light].name} when the phone is light, ${THEMES[AUTO_THEMES.dark].name} when it is dark`}
        testID="theme-auto"
      >
        <View style={styles.autoPreviews}>
          <ThemePreview id={AUTO_THEMES.light} style={styles.autoPreview} />
          <ThemePreview id={AUTO_THEMES.dark} style={styles.autoPreview} />
        </View>
        <View style={styles.autoText}>
          <Text style={styles.name}>Automatic</Text>
          <Text style={styles.autoHint}>
            {THEMES[AUTO_THEMES.light].name} by day, {THEMES[AUTO_THEMES.dark].name} when your phone is set to dark
          </Text>
        </View>
        <Check selected={autoSelected} Colors={Colors} />
      </TouchableOpacity>

      <View style={styles.grid}>
        {THEME_ORDER.map((id) => (
          <ThemeCard
            key={id}
            id={id}
            selected={choice === id}
            onPress={() => choose(id)}
            styles={styles}
            Colors={Colors}
          />
        ))}
      </View>
    </View>
  );
}

// The previews show each theme's own colours, whatever theme is on
const previewStyles = StyleSheet.create({
  frame: {
    height: 62,
    borderRadius: 8,
    padding: 7,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  line: {
    height: 5,
    borderRadius: 3,
  },
  lineThin: {
    height: 4,
    marginTop: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    width: 30,
    height: 11,
    borderRadius: 6,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
});

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    autoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 8,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.border,
      marginBottom: 10,
    },
    autoPreviews: {
      flexDirection: 'row',
      width: 104,
      borderRadius: 8,
      overflow: 'hidden',
    },
    autoPreview: {
      flex: 1,
      borderRadius: 0,
    },
    autoText: {
      flex: 1,
      gap: 2,
    },
    autoHint: {
      fontSize: 12,
      lineHeight: 16,
      color: Colors.textSecondary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    card: {
      flexGrow: 1,
      flexBasis: '30%',
      padding: 6,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.border,
      gap: 6,
    },
    cardSelected: {
      borderColor: Colors.primary,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
      paddingHorizontal: 2,
    },
    name: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '700',
      color: Colors.text,
    },
  });
