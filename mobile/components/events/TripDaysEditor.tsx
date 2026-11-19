import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Icon } from '../ui/Icon';
import { ActionSheet } from '../ui/ActionSheet';
import { TrailPickerSheet } from '../trail/TrailPickerSheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { haptics } from '../../utils/haptics';
import type { DraftDay } from '../../utils/trips';

export type { DraftDay } from '../../utils/trips';
export { daysForApi } from '../../utils/trips';

/** Day 2 onwards; day 1 is the trip's own trail. */
export const MAX_EXTRA_DAYS = 13;

let nextKey = 0;
const newKey = () => `day-${Date.now()}-${nextKey++}`;

interface TripDaysEditorProps {
  firstTrailName: string;
  days: DraftDay[];
  onChange: (days: DraftDay[]) => void;
}

/**
 * The days of a trip in the plan form: day 1 is this trail; "Add a day" adds another trail or
 * a day without one (a rest day, a transfer), each with an optional note.
 */
export function TripDaysEditor({ firstTrailName, days, onChange }: TripDaysEditorProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [choosing, setChoosing] = useState(false);
  const [picking, setPicking] = useState(false);

  const update = (key: string, patch: Partial<DraftDay>) =>
    onChange(days.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const remove = (key: string) => {
    haptics.tap();
    onChange(days.filter((d) => d.key !== key));
  };

  return (
    <View style={styles.container} testID="trip-days">
      <Text style={styles.heading}>Days</Text>
      <View style={styles.day}>
        <Text style={styles.dayNumber}>Day 1</Text>
        <Text style={styles.dayLabel} numberOfLines={1}>
          {firstTrailName}
        </Text>
      </View>

      {days.map((day, i) => (
        <View key={day.key} style={styles.extra}>
          <View style={styles.day}>
            <Text style={styles.dayNumber}>Day {i + 2}</Text>
            {day.trailId ? (
              <Text style={styles.dayLabel} numberOfLines={1}>
                {day.trailName}
              </Text>
            ) : (
              <TextInput
                style={[styles.dayLabel, styles.titleInput]}
                value={day.title}
                onChangeText={(title) => update(day.key, { title })}
                placeholder="What happens this day? e.g. Rest day in Mestia"
                placeholderTextColor={Colors.textLight}
                maxLength={80}
                accessibilityLabel={`Day ${i + 2} title`}
                testID={`trip-day-title-${i + 2}`}
              />
            )}
            <TouchableOpacity
              onPress={() => remove(day.key)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove day ${i + 2}`}
              testID={`trip-day-remove-${i + 2}`}
            >
              <Icon name="close-circle" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.note}
            value={day.note}
            onChangeText={(note) => update(day.key, { note })}
            placeholder="Note (optional): where you sleep, transport…"
            placeholderTextColor={Colors.textLight}
            maxLength={500}
            accessibilityLabel={`Day ${i + 2} note`}
          />
        </View>
      ))}

      {days.length < MAX_EXTRA_DAYS ? (
        <TouchableOpacity
          style={styles.add}
          onPress={() => setChoosing(true)}
          accessibilityRole="button"
          testID="trip-add-day"
        >
          <Icon name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.addText}>{days.length ? 'Add another day' : 'Add a day: make it a multi-day trip'}</Text>
        </TouchableOpacity>
      ) : null}

      <ActionSheet
        visible={choosing}
        title={`Day ${days.length + 2}`}
        options={[
          { key: 'trail', label: 'Another trail', icon: 'trail-sign-outline' },
          { key: 'free', label: 'A day without a trail', icon: 'bed-outline' },
        ]}
        onSelect={(key) => {
          if (key === 'trail') setPicking(true);
          else onChange([...days, { key: newKey(), trailId: null, trailName: null, title: '', note: '' }]);
        }}
        onClose={() => setChoosing(false)}
        closeOnSelect
      />
      <TrailPickerSheet
        visible={picking}
        title={`Day ${days.length + 2}: which trail?`}
        onClose={() => setPicking(false)}
        onPick={(trail) =>
          onChange([...days, { key: newKey(), trailId: trail.id, trailName: trail.name_en, title: '', note: '' }])
        }
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    heading: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    extra: {
      gap: 6,
    },
    day: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dayNumber: {
      width: 48,
      fontSize: 13,
      fontWeight: '700',
      color: Colors.primary,
    },
    dayLabel: {
      flex: 1,
      fontSize: 15,
      color: Colors.text,
    },
    titleInput: {
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    note: {
      marginLeft: 58,
      paddingVertical: 6,
      fontSize: 13,
      color: Colors.text,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    addText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
  });
