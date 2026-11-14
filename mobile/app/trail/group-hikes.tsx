import React, { useMemo, useState } from 'react';
import { View, Text, SectionList, StyleSheet, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/Icon';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorState } from '../../components/ui/ErrorState';
import { GroupHikeCard } from '../../components/events/GroupHikeCard';
import { useColors, ColorPalette } from '../../constants/colors';
import { useUpcomingEvents } from '../../hooks/useEvents';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { useTrails } from '../../hooks/useTrails';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuthStore } from '../../store/authStore';
import { groupUpcomingHikes } from '../../utils/groupHikes';
import { withBottomInset } from '../../utils/insets';
import { haptics } from '../../utils/haptics';

/** Choose the trail for a new group hike; the trail's group hike form then opens. */
function TrailPicker({ visible, onClose, Colors, styles }: { visible: boolean; onClose: () => void; Colors: ColorPalette; styles: ReturnType<typeof createStyles> }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isLoading } = useTrails({ search: debounced || undefined, limit: 20 }, visible);
  const trails = data?.pages.flatMap((p) => p.data) ?? [];

  const pick = (trailId: string) => {
    haptics.select();
    onClose();
    router.push(`/trail/${trailId}/events?create=1` as never);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Which trail?" scrollable={false}>
      <View style={styles.pickerSearch}>
        <Icon name="search" size={18} color={Colors.textLight} />
        <TextInput
          style={styles.pickerInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search trails"
          placeholderTextColor={Colors.textLight}
          autoCorrect={false}
          accessibilityLabel="Search trails"
        />
      </View>
      <View style={styles.pickerList}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 24 }} />
        ) : (
          trails.slice(0, 20).map((t) => (
            <TouchableOpacity key={t.id} style={styles.pickerRow} onPress={() => pick(t.id)} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerName} numberOfLines={1}>
                  {t.name_en}
                </Text>
                <Text style={styles.pickerRegion} numberOfLines={1}>
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
  const sections = useMemo(() => groupUpcomingHikes(events), [events]);

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
            <Text style={styles.intro}>Hikes other people are organizing. Open one to see who's going and join.</Text>
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
      <TrailPicker visible={picking} onClose={() => setPicking(false)} Colors={Colors} styles={styles} />
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
    pickerSearch: {
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
    pickerInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 15,
      color: Colors.text,
    },
    pickerList: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    pickerName: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    pickerRegion: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
  });
