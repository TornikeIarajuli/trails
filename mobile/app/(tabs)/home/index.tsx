import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrails, useRegions } from '../../../hooks/useTrails';
import { useDebounce } from '../../../hooks/useDebounce';
import { TrailCard } from '../../../components/trail/TrailCard';
import { TrailFilters } from '../../../components/trail/TrailFilters';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ActiveHikeBanner } from '../../../components/hike/ActiveHikeBanner';
import { TrailDifficulty, Trail } from '../../../types/trail';
import { parseGeoPoint } from '../../../utils/geo';
import { Config } from '../../../constants/config';

export default function HomeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const debouncedSearch = useDebounce(search, 300);

  const { data: regions } = useRegions();

  const params = useMemo(
    () => ({
      ...(difficulty && { difficulty }),
      ...(region && { region }),
      ...(debouncedSearch && { search: debouncedSearch }),
      limit: viewMode === 'map' ? 200 : 20,
    }),
    [difficulty, region, debouncedSearch, viewMode],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useTrails(params);

  const trails = useMemo(() => {
    const all = data?.pages.flatMap((page) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [data]);

  return (
    <View style={styles.container}>
      <ActiveHikeBanner />

      <TrailFilters
        search={search}
        onSearchChange={setSearch}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        region={region}
        onRegionChange={setRegion}
        regions={regions ?? []}
      />

      {/* List / Map toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={viewMode === 'list' ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons
            name="map-outline"
            size={18}
            color={viewMode === 'map' ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : viewMode === 'list' ? (
        <FlatList
          data={trails}
          keyExtractor={(item: Trail) => item.id}
          renderItem={({ item }) => <TrailCard trail={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          getItemLayout={(_data, index) => ({
            length: 264,
            offset: 264 * index,
            index,
          })}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No trails found</Text>
            </View>
          }
        />
      ) : (
        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={Config.DEFAULT_MAP_REGION}
        >
          {trails.map((trail) => {
            const coord = trail.start_point ? parseGeoPoint(trail.start_point) : null;
            if (!coord) return null;
            return (
              <Marker
                key={trail.id}
                coordinate={coord}
                pinColor={Colors.difficulty[trail.difficulty]}
              >
                <Callout onPress={() => router.push(`/trail/${trail.id}` as any)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutName} numberOfLines={2}>
                      {trail.name_en}
                    </Text>
                    <Text
                      style={[
                        styles.calloutDifficulty,
                        { color: Colors.difficulty[trail.difficulty] },
                      ]}
                    >
                      {trail.difficulty}
                    </Text>
                    {trail.distance_km != null && (
                      <Text style={styles.calloutDetail}>{trail.distance_km} km</Text>
                    )}
                    <Text style={styles.calloutTap}>Tap to open →</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    list: {
      paddingTop: 12,
      paddingBottom: 20,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 80,
    },
    emptyText: {
      fontSize: 16,
      color: Colors.textLight,
    },
    viewToggle: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 6,
      gap: 4,
    },
    toggleButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleButtonActive: {
      backgroundColor: Colors.primary + '15',
    },
    map: {
      flex: 1,
    },
    callout: {
      width: 160,
      padding: 10,
    },
    calloutName: {
      fontSize: 14,
      fontWeight: '700',
      color: '#1a1a1a',
      marginBottom: 2,
    },
    calloutDifficulty: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
      marginBottom: 2,
    },
    calloutDetail: {
      fontSize: 12,
      color: '#555',
    },
    calloutTap: {
      fontSize: 11,
      color: '#888',
      marginTop: 4,
    },
  });
