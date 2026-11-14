import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/Icon';
import { SheetButton } from '../../components/ui/Sheet';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useColors, ColorPalette } from '../../constants/colors';
import { useCheckIn, useFinishCheckIn, useSetBackBy } from '../../hooks/useCheckIn';
import { useHikeStore } from '../../store/hikeStore';
import { formatClock, formatFromNow, oneHourLater } from '../../utils/backBy';
import { getErrorMessage } from '../../utils/showError';
import { withBottomInset } from '../../utils/insets';
import { haptics } from '../../utils/haptics';

/**
 * What "Are you back?" opens: check in ("I'm back"), or add an hour when the hike takes
 * longer. Answering after the emergency contact was alerted tells them too.
 */
export default function CheckInScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { data, isLoading, error, refetch, isRefetching } = useCheckIn();
  const finish = useFinishCheckIn();
  const setBackBy = useSetBackBy();
  const [done, setDone] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const hikeRunning = useHikeStore((s) => s.isActive && s.trailId === data?.check_in?.trail_id);

  const header = <Stack.Screen options={{ headerShown: true, title: 'Check in' }} />;

  if (isLoading && !data) {
    return (
      <>
        {header}
        <LoadingSpinner />
      </>
    );
  }
  if (!data) {
    return (
      <>
        {header}
        <ErrorState error={error} title="Couldn't check" onRetry={() => refetch()} retrying={isRefetching} />
      </>
    );
  }

  const checkIn = data.check_in;
  const contact = data.emergency_contact?.username ?? 'your emergency contact';

  if (done || !checkIn) {
    return (
      <>
        {header}
        <View style={[styles.center, { paddingBottom: insets.bottom + 24 }]} testID="check-in-done">
          <View style={styles.badge}>
            <Icon name="checkmark-circle" size={44} color={Colors.success} />
          </View>
          <Text style={styles.title}>{done ?? 'You are checked in'}</Text>
          <Text style={styles.text}>Nothing is waiting for an answer.</Text>
          <SheetButton title="Close" variant="secondary" onPress={() => router.back()} />
        </View>
      </>
    );
  }

  const backBy = new Date(checkIn.back_by);
  const now = new Date();
  const late = backBy.getTime() <= now.getTime();

  const imBack = () => {
    setFailure(null);
    finish.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        setDone(checkIn.status === 'alerted' ? `Checked in. ${contact} hears you are back.` : 'Welcome back!');
      },
      onError: (err) => setFailure(getErrorMessage(err, 'Could not reach the server. Try again where you have signal.')),
    });
  };

  const addHour = () => {
    if (!checkIn.trail_id) return;
    setFailure(null);
    setBackBy.mutate(
      { trailId: checkIn.trail_id, backBy: oneHourLater(new Date(), backBy) },
      {
        onSuccess: () => {
          haptics.success();
          setDone(checkIn.status === 'alerted' ? `New time set. ${contact} hears you are fine.` : 'One more hour. Enjoy the trail!');
        },
        onError: (err) => setFailure(getErrorMessage(err, 'Could not reach the server. Try again where you have signal.')),
      },
    );
  };

  return (
    <>
      {header}
      <ScrollView style={styles.container} contentContainerStyle={withBottomInset(styles.content, insets.bottom)}>
        <View style={styles.badge}>
          <Icon name={checkIn.status === 'alerted' ? 'alert-circle' : 'time-outline'} size={44} color={checkIn.status === 'alerted' ? Colors.error : Colors.primary} />
        </View>
        <Text style={styles.title}>{late ? 'Are you back?' : `Back by ${formatClock(backBy)}`}</Text>
        <Text style={styles.text}>
          {checkIn.trail_name ? `${checkIn.trail_name}: ` : ''}
          {late
            ? `you planned to be back by ${formatClock(backBy)}.`
            : `you planned to be back ${formatFromNow(now, backBy)}.`}
        </Text>
        <Text style={[styles.text, checkIn.status === 'alerted' && styles.alerted]} testID="check-in-status">
          {checkIn.status === 'alerted'
            ? `${contact} was told you are late. Check in so they know you are fine.`
            : late
              ? `Check in now, or ${contact} is alerted 30 minutes after that time.`
              : `If you are not back by then, ${contact} is alerted 30 minutes later.`}
        </Text>

        <View style={styles.actions}>
          <SheetButton title="I'm back" onPress={imBack} loading={finish.isPending} disabled={finish.isPending || setBackBy.isPending} testID="check-in-back" />
          <SheetButton
            title="Add 1 hour"
            variant="secondary"
            onPress={addHour}
            loading={setBackBy.isPending}
            disabled={finish.isPending || setBackBy.isPending || !checkIn.trail_id}
            testID="check-in-add-hour"
          />
          {hikeRunning && checkIn.trail_id ? (
            <SheetButton title="Open the hike" variant="secondary" onPress={() => router.push(`/trail/${checkIn.trail_id}/hike` as never)} />
          ) : null}
        </View>
        {failure ? <Text style={styles.error}>{failure}</Text> : null}
      </ScrollView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 32,
      gap: 12,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
      backgroundColor: Colors.background,
    },
    badge: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.borderLight,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: Colors.text,
      textAlign: 'center',
    },
    text: {
      fontSize: 15,
      lineHeight: 21,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    alerted: {
      color: Colors.error,
      fontWeight: '600',
    },
    actions: {
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 12,
    },
    error: {
      fontSize: 13,
      color: Colors.error,
      textAlign: 'center',
    },
  });
