import React, { useMemo, useState } from 'react';
import { View, Text, SectionList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/Icon';
import { ErrorState } from '../../components/ui/ErrorState';
import { GroupHikeCard } from '../../components/events/GroupHikeCard';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyEvents, useUpcomingEvents } from '../../hooks/useEvents';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { TrailPickerSheet } from '../../components/trail/TrailPickerSheet';
import { useAuthStore } from '../../store/authStore';
import { HikeSection, groupUpcomingHikes } from '../../utils/groupHikes';
import type { TrailEvent } from '../../services/events';
import { withBottomInset } from '../../utils/insets';
import { haptics } from '../../utils/haptics';

/**
 * Every upcoming group hike on any trail, for "what could I do?": This week, Next week, Later.
 * Each opens the hike, where it can be joined; a new one starts from any trail.
 */
export default function GroupHikesScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [picking, setPicking] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useUpcomingEvents();
  const events = useWithoutBlocked(data, (e) => e.organizer_id);
  // Your own trips and hikes first (private ones too), then everyone's, without repeats
  const { data: mine } = useMyEvents();
  const myEvents = useWithoutBlocked(mine, (e) => e.organizer_id);
  const sections = useMemo(() => {
    const mineIds = new Set(myEvents.map((e) => e.id));
    const rest = groupUpcomingHikes(events.filter((e) => !mineIds.has(e.id)));
    const own: HikeSection<TrailEvent>[] = myEvents.length
      ? [{ key: 'mine', title: 'Your trips and hikes', data: myEvents }]
      : [];
    return [...own, ...rest];
  }, [events, myEvents]);

  const plan = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign in to plan a hike', 'Log in to organize a group hike.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    haptics.tap();
    setPicking(true);
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />;
  } else if (isError && !data) {
    body = <ErrorState error={error} title="Couldn't load group hikes" onRetry={() => refetch()} retrying={isRefetching} />;
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => <GroupHikeCard event={item} userId={userId} variant="row" />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={withBottomInset(sections.length ? styles.listContent : styles.emptyContainer, insets.bottom)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListHeaderComponent={
          sections.length ? (
            <Text style={styles.intro}>Group hikes and trips people are organizing. Open one to see who's going and join.</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="people-outline" size={36} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No group hikes planned yet</Text>
            <Text style={styles.emptyText}>Pick a trail, choose a day and invite others to hike it with you.</Text>
            <TouchableOpacity style={styles.planButton} onPress={plan} accessibilityRole="button">
              <Icon name="add" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.planButtonText}>Plan a group hike</Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Group hikes',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={plan} hitSlop={8} accessibilityRole="button" accessibilityLabel="Plan a group hike">
              <Icon name="add" size={24} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      {body}
      {/* Choose the trail for a new group hike; the trail's group hike form then opens */}
      <TrailPickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(trail) => router.push(`/trail/${trail.id}/events?create=1` as never)}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    listContent: {
      paddingBottom: 16,
    },
    intro: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.text,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 8,
    },
    emptyContainer: {
      flexGrow: 1,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 32,
      paddingVertical: 48,
    },
    emptyIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.borderLight,
      marginBottom: 6,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    planButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    planButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
  });
