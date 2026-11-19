import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { Sheet, SheetButton, SheetTextInput } from '../../components/ui/Sheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { useAnswerBooking, useBookings } from '../../hooks/useGuides';
import { bookingDates, bookingStatusLabel } from '../../utils/guides';
import { getErrorMessage } from '../../utils/showError';
import { haptics } from '../../utils/haptics';
import { withBottomInset } from '../../utils/insets';
import type { Booking } from '../../services/guides';

type Tab = 'hiker' | 'guide';

/**
 * My bookings: the requests you sent to guides, and (for guides) the requests sent to you, to
 * accept or decline with a reply. An accepted request shows the guide's contact on their page.
 */
export default function BookingsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { data, isLoading, isError, error, refetch, isRefetching } = useBookings();
  const answer = useAnswerBooking();
  const hasGuideTab = (data?.as_guide.length ?? 0) > 0;
  const [tab, setTab] = useState<Tab>(params.tab === 'guide' ? 'guide' : 'hiker');
  const [replying, setReplying] = useState<{ booking: Booking; status: 'accepted' | 'declined' } | null>(null);
  const [reply, setReply] = useState('');

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'My bookings',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (isLoading) return <LoadingSpinner />;
  if (isError && !data) {
    return (
      <>
        {header}
        <ErrorState error={error} title="Couldn't load your bookings" onRetry={() => refetch()} retrying={isRefetching} />
      </>
    );
  }

  const shownTab: Tab = tab === 'guide' && hasGuideTab ? 'guide' : 'hiker';
  const rows = shownTab === 'guide' ? data?.as_guide ?? [] : data?.as_hiker ?? [];

  const cancel = (booking: Booking) =>
    Alert.alert('Cancel this booking?', 'The guide is told.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => answer.mutate({ id: booking.id, status: 'cancelled' }, { onError: (e) => Alert.alert("Couldn't cancel", getErrorMessage(e)) }),
      },
    ]);

  const sendAnswer = () => {
    if (!replying) return;
    answer.mutate(
      { id: replying.booking.id, status: replying.status, reply: reply.trim() || undefined },
      {
        onSuccess: () => {
          haptics.success();
          setReplying(null);
          setReply('');
        },
        onError: (e) => Alert.alert("Couldn't answer", getErrorMessage(e)),
      },
    );
  };

  const renderItem = ({ item }: { item: Booking }) => {
    const asGuide = shownTab === 'guide';
    const other = asGuide ? item.hiker : item.guide?.profiles;
    const name = other?.username ?? (asGuide ? 'Hiker' : 'Guide');
    const statusColor =
      item.status === 'accepted' ? Colors.success : item.status === 'requested' ? Colors.warning : Colors.textLight;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => (asGuide ? router.push(`/trail/user/${item.hiker_id}` as never) : router.push(`/trail/guides/${item.guide_id}` as never))}
        activeOpacity={0.8}
        accessibilityRole="button"
        testID={`booking-${item.id}`}
      >
        <View style={styles.cardTop}>
          <Avatar uri={other?.avatar_url ?? null} name={name} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>
              {bookingDates(item.start_date, item.days)} · {item.group_size} {item.group_size === 1 ? 'person' : 'people'}
              {item.trails ? ` · ${item.trails.name_en}` : ''}
            </Text>
          </View>
          <Text style={[styles.status, { color: statusColor }]}>{bookingStatusLabel(item.status, shownTab)}</Text>
        </View>
        <Text style={styles.message} numberOfLines={4}>
          {item.message}
        </Text>
        {item.guide_reply ? <Text style={styles.reply}>Reply: {item.guide_reply}</Text> : null}
        {!asGuide && item.status === 'accepted' ? <Text style={styles.hint}>Open the guide to see their phone number.</Text> : null}

        <View style={styles.actions}>
          {asGuide && item.status === 'requested' ? (
            <>
              <TouchableOpacity style={[styles.action, styles.accept]} onPress={() => setReplying({ booking: item, status: 'accepted' })} accessibilityRole="button" testID={`booking-accept-${item.id}`}>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => setReplying({ booking: item, status: 'declined' })} accessibilityRole="button" testID={`booking-decline-${item.id}`}>
                <Text style={styles.actionText}>Decline</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {!asGuide && (item.status === 'requested' || item.status === 'accepted') ? (
            <TouchableOpacity style={styles.action} onPress={() => cancel(item)} accessibilityRole="button" testID={`booking-cancel-${item.id}`}>
              <Text style={styles.actionText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {header}
      {hasGuideTab ? (
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['hiker', 'guide'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, shownTab === t && styles.tabActive]} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: shownTab === t }} testID={`bookings-tab-${t}`}>
              <Text style={[styles.tabText, shownTab === t && styles.tabTextActive]}>
                {t === 'hiker' ? 'My requests' : `Requests to me${data?.as_guide.some((b) => b.status === 'requested') ? ' •' : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(b) => b.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={withBottomInset(styles.list, insets.bottom)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{shownTab === 'guide' ? 'No requests yet' : 'No bookings yet'}</Text>
            <Text style={styles.emptyText}>
              {shownTab === 'guide' ? 'Requests from hikers show up here.' : 'Find a local guide and send them a request.'}
            </Text>
            {shownTab === 'hiker' ? (
              <TouchableOpacity onPress={() => router.push('/trail/guides' as never)} accessibilityRole="button">
                <Text style={styles.link}>Find a guide</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <Sheet
        visible={!!replying}
        onClose={() => setReplying(null)}
        title={replying?.status === 'accepted' ? 'Accept the request' : 'Decline the request'}
        dismissible={!answer.isPending}
        footer={
          <SheetButton
            title={replying?.status === 'accepted' ? 'Accept' : 'Decline'}
            onPress={sendAnswer}
            loading={answer.isPending}
            testID="booking-answer-send"
          />
        }
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            {replying?.status === 'accepted'
              ? 'The hiker gets your phone and messengers to settle the details. Add a note if you like.'
              : 'Let them know why, or suggest another date (optional).'}
          </Text>
          <SheetTextInput
            style={styles.replyInput}
            value={reply}
            onChangeText={setReply}
            placeholder={replying?.status === 'accepted' ? 'e.g. Meet at 7 in Mestia' : 'e.g. Fully booked that week, free from the 20th'}
            placeholderTextColor={Colors.textLight}
            multiline
            maxLength={1000}
            accessibilityLabel="Reply"
          />
        </View>
      </Sheet>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 8,
      padding: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    tab: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
    },
    tabActive: {
      backgroundColor: Colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    tabTextActive: {
      color: Colors.textOnPrimary,
    },
    list: {
      padding: 16,
    },
    card: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: Colors.surface,
      gap: 8,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    meta: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    status: {
      fontSize: 12,
      fontWeight: '700',
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.text,
    },
    reply: {
      fontSize: 13,
      fontStyle: 'italic',
      color: Colors.textSecondary,
    },
    hint: {
      fontSize: 12,
      color: Colors.success,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    action: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    accept: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    acceptText: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingTop: 48,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    link: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.primary,
      marginTop: 4,
    },
    sheetBody: {
      paddingHorizontal: 16,
      gap: 10,
    },
    sheetText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    replyInput: {
      minHeight: 80,
      padding: 12,
      fontSize: 15,
      color: Colors.text,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      textAlignVertical: 'top',
    },
  });
