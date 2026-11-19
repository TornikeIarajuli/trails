import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { ErrorState } from '../../../components/ui/ErrorState';
import { PlaceRow } from '../../../components/places/PlaceRow';
import { PlacesMap } from '../../../components/places/PlacesMap';
import { useColors, ColorPalette } from '../../../constants/colors';
import { usePlaces } from '../../../hooks/usePlaces';
import type { PlaceKind } from '../../../services/places';
import { PLACE_KINDS, kindMeta, placeSubtitle } from '../../../utils/places';
import { withBottomInset } from '../../../utils/insets';
import { haptics } from '../../../utils/haptics';

const SEARCH_DELAY_MS = 300;

/**
 * Places beyond trails, from OpenStreetMap: lakes, waterfalls, peaks, viewpoints, campsites,
 * huts, caves, canyons, glaciers, fortresses, towers, monasteries, hot springs, fishing spots.
 * By kind (`?kind=lake`) and by name, as a list or on the map.
 */
export default function PlacesScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<PlaceKind | undefined>(
    PLACE_KINDS.some((k) => k.key === params.kind) ? (params.kind as PlaceKind) : undefined,
  );
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const query = usePlaces({ kind, q: q || undefined });
  const places = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const points = useMemo(
    () => places.map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude, title: p.name_en, description: placeSubtitle(p) })),
    [places],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.searchRow}>
        <Icon name="search" size={20} color={Colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search lakes, waterfalls, fortresses…"
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search places"
          testID="places-search"
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search" accessibilityRole="button">
            <Icon name="close-circle" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds}>
        {[undefined, ...PLACE_KINDS.map((k) => k.key)].map((k) => {
          const active = k === kind;
          const meta = k ? kindMeta(k) : null;
          return (
            <TouchableOpacity
              key={k ?? 'all'}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                haptics.select();
                setKind(k);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`places-kind-${k ?? 'all'}`}
            >
              {meta ? <Icon name={meta.icon} size={14} color={active ? Colors.textOnPrimary : Colors.textSecondary} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta ? meta.plural : 'All'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.toolbar}>
        <Text style={styles.count} testID="places-count">
          {query.isLoading ? ' ' : `${total.toLocaleString('en-US')} ${total === 1 ? 'place' : 'places'}`}
        </Text>
        <TouchableOpacity
          style={styles.routesLink}
          onPress={() => {
            haptics.tap();
            router.push('/trail/places/routes' as never);
          }}
          accessibilityRole="button"
          testID="places-routes"
        >
          <Icon name="route" size={16} color={Colors.primary} />
          <Text style={styles.linkText}>Day routes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.routesLink}
          onPress={() => {
            haptics.select();
            setView(view === 'list' ? 'map' : 'list');
          }}
          accessibilityRole="button"
          accessibilityLabel={view === 'list' ? 'Show on the map' : 'Show as a list'}
          testID="places-view-toggle"
        >
          <Icon name={view === 'list' ? 'map-outline' : 'list'} size={16} color={Colors.primary} />
          <Text style={styles.linkText}>{view === 'list' ? 'Map' : 'List'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const screen = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Places',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (query.isError && places.length === 0) {
    return (
      <View style={styles.container}>
        {screen}
        {header}
        <ErrorState error={query.error} title="Couldn't load the places" onRetry={() => query.refetch()} retrying={query.isRefetching} />
      </View>
    );
  }

  if (view === 'map') {
    return (
      <View style={styles.container}>
        {screen}
        {header}
        {places.length > 0 ? (
          <PlacesMap
            points={points}
            height={420}
            onPressPoint={(id) => router.push(`/trail/places/${id}` as never)}
            style={{ flex: 1 }}
          />
        ) : null}
        {query.hasNextPage ? (
          <TouchableOpacity style={styles.more} onPress={() => query.fetchNextPage()} accessibilityRole="button" disabled={query.isFetchingNextPage}>
            <Text style={styles.linkText}>
              {query.isFetchingNextPage ? 'Loading…' : `Showing ${places.length} of ${total.toLocaleString('en-US')}: show more`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {screen}
      <FlatList
        data={places}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlaceRow place={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={withBottomInset(styles.list, insets.bottom)}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <View style={styles.empty}>
              <Icon name="location-outline" size={40} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>{q || kind ? 'No places match' : 'Places are on their way'}</Text>
              <Text style={styles.emptyText}>
                {q || kind ? 'Try another name or kind.' : 'Lakes, waterfalls and fortresses are being added: check back soon.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} /> : null}
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
    header: {
      paddingTop: 8,
      paddingBottom: 12,
      gap: 12,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: 12,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: Colors.text,
    },
    kinds: {
      gap: 8,
      paddingHorizontal: 16,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 16,
    },
    count: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
    },
    routesLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    linkText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    list: {
      paddingBottom: 16,
    },
    more: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingTop: 48,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
  });
