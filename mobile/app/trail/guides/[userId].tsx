import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ContentMenu } from '../../../components/moderation/ContentMenu';
import { BookingSheet } from '../../../components/guides/BookingSheet';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useBookings, useGuide, useGuideContact } from '../../../hooks/useGuides';
import { useAuthStore } from '../../../store/authStore';
import { bookingDates, bookingStatusLabel, priceLabel } from '../../../utils/guides';
import { getErrorStatus } from '../../../utils/showError';
import { haptics } from '../../../utils/haptics';

/**
 * A verified guide: who they are, where and in which languages they guide, the trails they
 * know, the price, and a booking request. Their phone and messengers show once they accepted
 * one of your requests.
 */
export default function GuideProfileScreen() {
  const { userId, trailId } = useLocalSearchParams<{ userId: string; trailId?: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: guide, isLoading, error, refetch, isRefetching } = useGuide(userId);
  const { data: bookings } = useBookings();
  const [booking, setBooking] = useState(false);

  // Your latest request to this guide, and whether they accepted one
  const mine = (bookings?.as_hiker ?? []).filter((b) => b.guide_id === userId);
  const accepted = mine.some((b) => b.status === 'accepted');
  const latest = mine[0];
  const { data: contact } = useGuideContact(userId, accepted);
  const own = me === userId;

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Guide',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (!guide) {
    if (isLoading) return <LoadingSpinner />;
    const gone = getErrorStatus(error) === 404;
    return (
      <>
        {header}
        <ErrorState
          error={error}
          title={gone ? 'Not a listed guide' : "Couldn't load this guide"}
          message={gone ? 'They may have paused their listing.' : undefined}
          onRetry={gone ? undefined : () => refetch()}
          retrying={isRefetching}
          showBack
        />
      </>
    );
  }

  const name = guide.profiles?.full_name || guide.profiles?.username || 'Guide';
  const price = priceLabel(guide);

  const open = (url: string) => {
    haptics.tap();
    Linking.openURL(url).catch(() => Alert.alert("Couldn't open it", url));
  };

  const requestBooking = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    haptics.tap();
    setBooking(true);
  };

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <View style={styles.top}>
          <Avatar uri={guide.profiles?.avatar_url ?? null} name={name} size={84} />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <Icon name="shield-checkmark" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.verified}>Verified guide</Text>
          <Text style={styles.headline}>{guide.headline}</Text>
          {price ? <Text style={styles.price}>{price}</Text> : null}
          {!own ? (
            <ContentMenu
              style={styles.menu}
              targetType="user"
              targetId={guide.user_id}
              targetLabel="guide"
              authorId={guide.user_id}
              authorName={guide.profiles?.username}
              iconSize={18}
            />
          ) : null}
        </View>

        {contact ? (
          <View style={[styles.card, styles.contactCard]} testID="guide-contact">
            <Text style={styles.cardTitle}>Contact {name}</Text>
            {contact.phone ? (
              <TouchableOpacity style={styles.contactRow} onPress={() => open(`tel:${contact.phone!.replace(/[^0-9+]/g, '')}`)} accessibilityRole="button">
                <Icon name="call-outline" size={18} color={Colors.primary} />
                <Text style={styles.contactText}>{contact.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {contact.whatsapp_url ? (
              <TouchableOpacity style={styles.contactRow} onPress={() => open(contact.whatsapp_url!)} accessibilityRole="button">
                <Icon name="chatbubble-outline" size={18} color={Colors.primary} />
                <Text style={styles.contactText}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
            {contact.telegram_url ? (
              <TouchableOpacity style={styles.contactRow} onPress={() => open(contact.telegram_url!)} accessibilityRole="button">
                <Icon name="send-outline" size={18} color={Colors.primary} />
                <Text style={styles.contactText}>Telegram @{contact.telegram}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {latest && !own ? (
          <TouchableOpacity style={styles.card} onPress={() => router.push('/trail/bookings' as never)} accessibilityRole="button" testID="guide-latest-booking">
            <Text style={styles.cardTitle}>Your request</Text>
            <Text style={styles.bodyText}>
              {bookingDates(latest.start_date, latest.days)} · {bookingStatusLabel(latest.status, 'hiker')}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.bodyText}>{guide.bio}</Text>
          {guide.certifications ? <Text style={styles.detail}>Certified: {guide.certifications}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Guides in</Text>
          <Text style={styles.bodyText}>{guide.regions.join(', ')}</Text>
          <Text style={[styles.cardTitle, styles.spaced]}>Speaks</Text>
          <Text style={styles.bodyText}>{guide.languages.join(', ')}</Text>
        </View>

        {guide.trails.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trails</Text>
            {guide.trails.map((t) => (
              <TouchableOpacity key={t.id} style={styles.trailRow} onPress={() => router.push(`/trail/${t.id}` as never)} accessibilityRole="button">
                <Icon name="trail-sign-outline" size={16} color={Colors.primary} />
                <Text style={styles.trailName} numberOfLines={1}>
                  {t.name_en}
                </Text>
                <Icon name="chevron-forward" size={14} color={Colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {own ? (
          <Button title="Edit your guide profile" variant="outline" onPress={() => router.push('/trail/guides/apply' as never)} />
        ) : (
          <Button title={isAuthenticated ? 'Request a booking' : 'Log in to book'} onPress={requestBooking} />
        )}
      </View>

      {!own ? (
        <BookingSheet
          visible={booking}
          onClose={() => setBooking(false)}
          guideId={guide.user_id}
          guideName={name}
          trails={guide.trails}
          initialTrailId={typeof trailId === 'string' ? trailId : undefined}
          onSent={() => {
            setBooking(false);
            Alert.alert('Request sent', `${name} will answer in the app. You'll find it under My bookings.`);
          }}
        />
      ) : null}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    top: {
      alignItems: 'center',
      gap: 4,
      paddingTop: 16,
      paddingHorizontal: 24,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    name: {
      fontSize: 22,
      fontWeight: '800',
      color: Colors.text,
    },
    verified: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.primary,
    },
    headline: {
      marginTop: 4,
      fontSize: 15,
      color: Colors.text,
      textAlign: 'center',
    },
    price: {
      marginTop: 2,
      fontSize: 15,
      fontWeight: '700',
      color: Colors.primary,
    },
    menu: {
      position: 'absolute',
      top: 12,
      right: 12,
    },
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      padding: 16,
      borderRadius: 14,
      backgroundColor: Colors.surface,
      gap: 6,
    },
    contactCard: {
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    spaced: {
      marginTop: 8,
    },
    bodyText: {
      fontSize: 15,
      lineHeight: 22,
      color: Colors.text,
    },
    detail: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    contactText: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
    },
    trailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    trailName: {
      flex: 1,
      fontSize: 15,
      color: Colors.text,
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: Colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
  });
