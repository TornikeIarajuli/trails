import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { useTrails } from '../../hooks/useTrails';
import { useDebounce } from '../../hooks/useDebounce';
import { haptics } from '../../utils/haptics';

export interface PickedTrail {
  id: string;
  name_en: string;
  region: string;
}

interface TrailPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (trail: PickedTrail) => void;
  title?: string;
}

/**
 * A sheet to choose a trail, with search: for a group hike, a post, a day of a trip. The sheet
 * closes on a pick, then `onPick` runs.
 */
export function TrailPickerSheet({ visible, onClose, onPick, title = 'Which trail?' }: TrailPickerSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isLoading } = useTrails({ search: debounced || undefined, limit: 20 }, visible);
  const trails = data?.pages.flatMap((p) => p.data) ?? [];

  const pick = (trail: PickedTrail) => {
    haptics.select();
    onClose();
    onPick(trail);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} scrollable={false}>
      <View style={styles.search}>
        <Icon name="search" size={18} color={Colors.textLight} />
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search trails"
          placeholderTextColor={Colors.textLight}
          autoCorrect={false}
          accessibilityLabel="Search trails"
          testID="trail-picker-search"
        />
      </View>
      <View style={styles.list}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loading} />
        ) : trails.length === 0 ? (
          <Text style={styles.empty}>No trail matches "{search.trim()}"</Text>
        ) : (
          trails.slice(0, 20).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.row}
              onPress={() => pick({ id: t.id, name_en: t.name_en, region: t.region })}
              accessibilityRole="button"
              testID={`trail-picker-${t.id}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {t.name_en}
                </Text>
                <Text style={styles.region} numberOfLines={1}>
                  {t.region}
                </Text>
              </View>
              <Icon name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.background,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 15,
      color: Colors.text,
    },
    list: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    loading: {
      paddingVertical: 24,
    },
    empty: {
      paddingVertical: 24,
      textAlign: 'center',
      fontSize: 14,
      color: Colors.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    rowText: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    region: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
  });
