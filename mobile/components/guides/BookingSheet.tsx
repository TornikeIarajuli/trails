import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Icon } from '../ui/Icon';
import { Sheet, SheetButton, SheetTextInput } from '../ui/Sheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { useRequestBooking } from '../../hooks/useGuides';
import { useSettingsStore } from '../../store/settingsStore';
import { bookingDates, localIsoDate } from '../../utils/guides';
import { getErrorMessage } from '../../utils/showError';
import { haptics } from '../../utils/haptics';
import type { GuideTrail } from '../../services/guides';

interface BookingSheetProps {
  visible: boolean;
  onClose: () => void;
  guideId: string;
  guideName: string;
  trails: GuideTrail[];
  /** Picked to begin with (the trail the hiker came from). */
  initialTrailId?: string;
  onSent: () => void;
}

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** A small "− 2 +" control. */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  styles,
  Colors,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
  testID: string;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Fewer ${label.toLowerCase()}`}
          testID={`${testID}-minus`}
        >
          <Icon name="remove" size={18} color={value <= min ? Colors.textLight : Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.stepperValue} testID={`${testID}-value`}>
          {value}
        </Text>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`More ${label.toLowerCase()}`}
          testID={`${testID}-plus`}
        >
          <Icon name="add" size={18} color={value >= max ? Colors.textLight : Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Ask a guide for a hike: the trail (one of theirs, or not decided yet), the first day, how
 * many days and people, and a message. They accept or decline; you hear back either way.
 */
export function BookingSheet({ visible, onClose, guideId, guideName, trails, initialTrailId, onSent }: BookingSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const request = useRequestBooking();
  const [trailId, setTrailId] = useState<string | null>(initialTrailId ?? null);
  const [date, setDate] = useState<Date>(tomorrow);
  const [picking, setPicking] = useState(false);
  const [days, setDays] = useState(1);
  const [people, setPeople] = useState(2);
  const [message, setMessage] = useState('');

  const startDate = localIsoDate(date);

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPicking(false);
    if (event.type === 'set' && selected) setDate(selected);
  };

  const send = () => {
    if (!message.trim()) {
      Alert.alert('Add a message', `Say hello to ${guideName} and what you have in mind.`);
      return;
    }
    request.mutate(
      {
        guide_id: guideId,
        ...(trailId ? { trail_id: trailId } : {}),
        start_date: startDate,
        days,
        group_size: people,
        message: message.trim(),
      },
      {
        onSuccess: () => {
          haptics.success();
          setMessage('');
          onSent();
        },
        onError: (err) => Alert.alert("Couldn't send the request", getErrorMessage(err)),
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Hike with ${guideName}`}
      dismissible={!request.isPending}
      footer={<SheetButton title="Send request" onPress={send} loading={request.isPending} testID="booking-send" />}
    >
      <View style={styles.body}>
        {trails.length > 0 ? (
          <>
            <Text style={styles.label}>Trail</Text>
            <View style={styles.chips}>
              {[...trails.map((t) => ({ id: t.id as string | null, name: t.name_en })), { id: null, name: 'Not decided yet' }].map(
                (t) => {
                  const selected = t.id === trailId;
                  return (
                    <TouchableOpacity
                      key={t.id ?? 'none'}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => setTrailId(t.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{t.name}</Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.label}>First day</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setPicking(true)} accessibilityRole="button" testID="booking-date">
          <Icon name="calendar-outline" size={18} color={Colors.primary} />
          <Text style={styles.dateText}>{bookingDates(startDate, days)}</Text>
        </TouchableOpacity>
        {picking ? (
          <View>
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
              minimumDate={new Date()}
              themeVariant={isDarkMode ? 'dark' : 'light'}
              onChange={onPick}
            />
            {Platform.OS === 'ios' ? (
              <TouchableOpacity onPress={() => setPicking(false)} accessibilityRole="button">
                <Text style={styles.done}>Done</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.steppers}>
          <Stepper label="Days" value={days} min={1} max={30} onChange={setDays} styles={styles} Colors={Colors} testID="booking-days" />
          <Stepper label="People" value={people} min={1} max={50} onChange={setPeople} styles={styles} Colors={Colors} testID="booking-people" />
        </View>

        <Text style={styles.label}>Message</Text>
        <SheetTextInput
          style={styles.message}
          value={message}
          onChangeText={setMessage}
          placeholder="Your experience, what you'd like to see, questions about the price…"
          placeholderTextColor={Colors.textLight}
          multiline
          maxLength={1000}
          accessibilityLabel="Message to the guide"
          testID="booking-message"
        />
        <Text style={styles.hint}>
          {guideName} answers in the app. If they accept, you get their phone number to settle the details.
        </Text>
      </View>
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: 16,
      gap: 8,
    },
    label: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      fontSize: 13,
      color: Colors.text,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
      fontWeight: '700',
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    dateText: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    done: {
      alignSelf: 'flex-end',
      padding: 8,
      fontSize: 15,
      fontWeight: '700',
      color: Colors.primary,
    },
    steppers: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 6,
    },
    stepper: {
      flex: 1,
      gap: 6,
    },
    stepperLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
    },
    stepperControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    stepperButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      fontSize: 17,
      fontWeight: '700',
      color: Colors.text,
      fontVariant: ['tabular-nums'],
    },
    message: {
      minHeight: 90,
      padding: 12,
      fontSize: 15,
      color: Colors.text,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      textAlignVertical: 'top',
    },
    hint: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textLight,
    },
  });
