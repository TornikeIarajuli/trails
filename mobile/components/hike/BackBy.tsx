import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Icon } from '../ui/Icon';
import { Sheet, SheetButton } from '../ui/Sheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { useCheckIn, useFinishCheckIn, useSetBackBy } from '../../hooks/useCheckIn';
import { backByOptions, formatClock, formatFromNow, fromPickedTime } from '../../utils/backBy';
import { getErrorMessage } from '../../utils/showError';
import { haptics } from '../../utils/haptics';

type Styles = ReturnType<typeof createStyles>;

interface Props {
  trailId: string;
  estimatedHours: number | null | undefined;
  /** Where the hiker is now, sent with the check-in. */
  currentPosition: () => { lat: number; lng: number } | null;
  isDarkMode?: boolean;
}

/**
 * "Back by" on the hike screen: a row in the bottom panel, and the sheet to set it. If the
 * hiker is not back by then, they get "Are you back?"; half an hour later their emergency
 * contact is alerted with the last position.
 */
export function BackByRow({ trailId, estimatedHours, currentPosition, isDarkMode }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [open, setOpen] = useState(false);
  const { data } = useCheckIn();

  const checkIn = data?.check_in && data.check_in.trail_id === trailId ? data.check_in : null;
  const contact = data?.emergency_contact?.username ?? null;

  let label = 'Back by · Off';
  let detail = contact ? `Tell ${contact} if you are late` : 'Tell someone if you are late';
  if (checkIn) {
    label = `Back by ${formatClock(new Date(checkIn.back_by))}`;
    detail =
      checkIn.status === 'alerted'
        ? `${contact ?? 'Your contact'} was told you are late. Tap to check in`
        : `${contact ?? 'Your contact'} is alerted if you are late`;
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, checkIn && styles.rowOn, checkIn?.status === 'alerted' && styles.rowAlerted, pressed && styles.pressed]}
        onPress={() => {
          haptics.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${detail}`}
        testID="back-by-row"
      >
        <Icon name="time-outline" size={18} color={checkIn ? Colors.textOnPrimary : Colors.primary} />
        <Text style={[styles.rowLabel, checkIn && styles.rowLabelOn]}>{label}</Text>
        <Text style={[styles.rowDetail, checkIn && styles.rowDetailOn]} numberOfLines={1}>
          {detail}
        </Text>
        <Icon name="chevron-forward" size={16} color={checkIn ? Colors.textOnPrimary : Colors.textLight} />
      </Pressable>
      <BackBySheet
        visible={open}
        onClose={() => setOpen(false)}
        trailId={trailId}
        estimatedHours={estimatedHours}
        currentPosition={currentPosition}
        isDarkMode={isDarkMode}
        styles={styles}
        Colors={Colors}
      />
    </>
  );
}

function BackBySheet({
  visible,
  onClose,
  trailId,
  estimatedHours,
  currentPosition,
  isDarkMode,
  styles,
  Colors,
}: Props & { visible: boolean; onClose: () => void; styles: Styles; Colors: ColorPalette }) {
  const { data, isLoading } = useCheckIn(visible);
  const setBackBy = useSetBackBy();
  const finish = useFinishCheckIn();
  const [now, setNow] = useState(() => new Date());
  const options = useMemo(() => backByOptions(now, estimatedHours), [now, estimatedHours]);
  const [chosen, setChosen] = useState<Date | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn = data?.check_in && data.check_in.trail_id === trailId ? data.check_in : null;
  const contact = data?.emergency_contact ?? null;
  const selected = chosen ?? (checkIn ? new Date(checkIn.back_by) : options[0].date);

  const save = () => {
    setError(null);
    setBackBy.mutate(
      { trailId, backBy: selected, position: currentPosition() },
      {
        onSuccess: () => {
          haptics.success();
          setChosen(null);
          onClose();
        },
        onError: (err) =>
          setError(
            getErrorMessage(
              err,
              'Could not reach the server. The alert only works once it is set, so try again where you have signal.',
            ),
          ),
      },
    );
  };

  const turnOff = () => {
    setError(null);
    finish.mutate(undefined, {
      onSuccess: () => {
        haptics.tap();
        onClose();
      },
    });
  };

  const onPicked = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setPicking(false);
    if (event.type === 'set' && picked) setChosen(fromPickedTime(new Date(), picked));
  };

  let body: React.ReactNode;
  if (isLoading && !data) {
    body = <ActivityIndicator color={Colors.primary} style={styles.loading} />;
  } else if (!contact) {
    body = (
      <View style={styles.section} testID="back-by-no-contact">
        <Text style={styles.text}>
          Someone has to be told if you are not back. Choose an emergency contact first: open the profile of
          someone who uses the app and tap “Set as Emergency Contact”.
        </Text>
        <SheetButton
          title="Find your emergency contact"
          onPress={() => {
            onClose();
            router.push('/search');
          }}
        />
      </View>
    );
  } else {
    body = (
      <View style={styles.section}>
        <Text style={styles.text}>
          If you are not back by then, you get “Are you back?”. Half an hour later {contact.username} is alerted, with
          the last position your phone sent.
        </Text>

        <View style={styles.chips}>
          {options.map((option) => {
            const active = selected.getTime() === option.date.getTime();
            return (
              <Pressable
                key={option.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  haptics.select();
                  setNow(new Date());
                  setChosen(option.date);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`back-by-option-${option.key}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={styles.chip}
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            testID="back-by-pick"
          >
            <Icon name="time-outline" size={15} color={Colors.text} />
            <Text style={styles.chipText}>Pick a time</Text>
          </Pressable>
        </View>

        {picking && (
          <DateTimePicker
            value={selected}
            mode="time"
            is24Hour
            display={Platform.OS === 'android' ? 'clock' : 'spinner'}
            themeVariant={isDarkMode ? 'dark' : 'light'}
            onChange={onPicked}
          />
        )}

        <Text style={styles.selected} testID="back-by-selected">
          Back by {formatClock(selected)} · {formatFromNow(new Date(), selected)}
        </Text>
        <Text style={styles.hint}>
          Without signal your phone cannot check in for you: choose a time you will surely be back in reach by.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Back by"
      footer={
        contact ? (
          <View style={styles.footer}>
            <SheetButton
              title={checkIn ? 'Update' : 'Set'}
              onPress={save}
              loading={setBackBy.isPending}
              disabled={setBackBy.isPending || finish.isPending}
              testID="back-by-save"
            />
            {checkIn ? (
              <SheetButton
                title="Turn off"
                variant="secondary"
                onPress={turnOff}
                loading={finish.isPending}
                disabled={setBackBy.isPending || finish.isPending}
                testID="back-by-off"
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      {body}
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      marginTop: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    rowOn: {
      borderColor: Colors.primary,
      backgroundColor: Colors.primary,
    },
    rowAlerted: {
      borderColor: '#B91C1C',
      backgroundColor: '#B91C1C',
    },
    pressed: {
      opacity: 0.8,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.text,
    },
    rowLabelOn: {
      color: Colors.textOnPrimary,
    },
    rowDetail: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
    },
    rowDetailOn: {
      color: Colors.textOnPrimary,
    },
    loading: {
      paddingVertical: 24,
    },
    section: {
      gap: 12,
      paddingBottom: 8,
    },
    text: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: {
      borderColor: Colors.primary,
      backgroundColor: Colors.primary,
    },
    chipText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
    },
    selected: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    hint: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textLight,
    },
    error: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.error,
    },
    footer: {
      gap: 8,
    },
  });
