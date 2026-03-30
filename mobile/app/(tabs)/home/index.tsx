import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrails, useRegions, useNearbyTrails } from '../../../hooks/useTrails';
import { useDebounce } from '../../../hooks/useDebounce';
import { TrailCard } from '../../../components/trail/TrailCard';
import { TrailFilters } from '../../../components/trail/TrailFilters';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ActiveHikeBanner } from '../../../components/hike/ActiveHikeBanner';
import { TrailDifficulty, Trail } from '../../../types/trail';
import { parseGeoPoint } from '../../../utils/geo';
import { Config } from '../../../constants/config';

const RADIUS_OPTIONS = [5, 15, 25] as const;
type Radius = (typeof RADIUS_OPTIONS)[number];

export default function HomeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radius, setRadius] = useState<Radius>(15);
  const [nearbyVersion, setNearbyVersion] = useState(0);
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

  const { data: nearbyData, isLoading: nearbyLoading } = useNearbyTrails(
    nearbyMode ? userLocation?.latitude : undefined,
    nearbyMode ? userLocation?.longitude : undefined,
    nearbyMode ? radius : undefined,
    nearbyMode ? nearbyVersion : undefined,
  );

  const trails = useMemo(() => {
    if (nearbyMode) return nearbyData ?? [];
    const all = data?.pages.flatMap((page) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [data, nearbyData, nearbyMode]);

  const handleNearbyToggle = async () => {
    if (nearbyMode) {
      setNearbyMode(false);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Please allow location access to find trails near you.');
      return;
    }
    try {
      // Reuse cached location if available for instant re-enable;
      // always fetch fresh to get updated position
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setNearbyVersion((v) => v + 1); // force React Query to treat this as a new request
      setNearbyMode(true);
    } catch {
      // If fresh fetch fails but we have a cached location, reuse it
      if (userLocation) {
        setNearbyVersion((v) => v + 1);
        setNearbyMode(true);
      } else {
        Alert.alert('Location error', 'Could not get your location. Please try again.');
      }
    }
  };

  const loading = nearbyMode ? nearbyLoading : isLoading;

  return (
    <View style={styles.container}>
      <ActiveHikeBanner />

      <TrailFilters
        search={search}
        onSearchChange={setSearch}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        region={nearbyMode ? null : region}
        onRegionChange={nearbyMode ? () => {} : setRegion}
        regions={nearbyMode ? [] : (regions ?? [])}
      />

      {/* Quick action chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickActions}
        contentContainerStyle={styles.quickActionsContent}
      >
        <TouchableOpacity
          style={[styles.quickChip, nearbyMode && styles.quickChipActive]}
          onPress={handleNearbyToggle}
          accessibilityLabel={nearbyMode ? 'Disable nearby trails' : 'Find trails near me'}
          accessibilityRole="button"
        >
          <Ionicons
            name={nearbyMode ? 'navigate' : 'navigate-outline'}
            size={16}
            color={nearbyMode ? Colors.accent : Colors.textSecondary}
          />
          <Text style={[styles.quickChipText, nearbyMode && styles.quickChipTextActive]}>Near Me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickChip, viewMode === 'map' && styles.quickChipActive]}
          onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
          accessibilityLabel={viewMode === 'map' ? 'Switch to list view' : 'Switch to map view'}
          accessibilityRole="button"
        >
          <Ionicons
            name={viewMode === 'map' ? 'map' : 'map-outline'}
            size={16}
            color={viewMode === 'map' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.quickChipText, viewMode === 'map' && styles.quickChipTextActive]}>Map</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickChip}
          onPress={() => router.push('/(tabs)/profile/bookmarks' as any)}
          accessibilityLabel="My bookmarks"
          accessibilityRole="button"
        >
          <Ionicons name="bookmark-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.quickChipText}>Bookmarks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickChip}
          onPress={() => router.push('/(tabs)/profile/recommendations' as any)}
          accessibilityLabel="Trail recommendations for you"
          accessibilityRole="button"
        >
          <Ionicons name="compass-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.quickChipText}>For You</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Toolbar: radius chips when nearby mode is active */}
      {nearbyMode && (
        <View style={styles.toolbar}>
          <View style={styles.radiusChips}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.radiusChip, radius === r && styles.radiusChipActive]}
                onPress={() => setRadius(r)}
              >
                <Text style={[styles.radiusChipText, radius === r && styles.radiusChipTextActive]}>
                  {r} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : viewMode === 'list' ? (
        <FlatList
          data={trails as Trail[]}
          keyExtractor={(item: Trail) => item.id}
          renderItem={({ item, index }) => <TrailCard trail={item} index={index} />}
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
            if (!nearbyMode && hasNextPage && !isFetchingNextPage) fetchNextPage();
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
              <Text style={styles.emptyText}>
                {nearbyMode ? `No trails within ${radius} km` : 'No trails found'}
              </Text>
            </View>
          }
        />
      ) : (
        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={
            nearbyMode && userLocation
              ? { ...userLocation, latitudeDelta: 0.3, longitudeDelta: 0.3 }
              : Config.DEFAULT_MAP_REGION
          }
        >
          {(trails as Trail[]).map((trail) => {
            const coord = trail.start_point ? parseGeoPoint(trail.start_point) : null;
            if (!coord) return null;
            return (
              <Marker
                key={trail.id}
                coordinate={coord}
                pinColor={Colors.difficulty[trail.difficulty]}
                title={trail.name_en}
                description={[trail.difficulty, trail.distance_km != null ? `${trail.distance_km} km` : null].filter(Boolean).join(' · ')}
                onPress={() => router.push(`/trail/${trail.id}` as any)}
              />
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
    quickActions: {
      flexGrow: 0,
      paddingVertical: 6,
    },
    quickActionsContent: {
      paddingHorizontal: 16,
      gap: 8,
      flexDirection: 'row',
    },
    quickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    quickChipActive: {
      backgroundColor: Colors.primary + '15',
      borderColor: Colors.primary + '40',
    },
    quickChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    quickChipTextActive: {
      color: Colors.primary,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    radiusChips: {
      flexDirection: 'row',
      gap: 6,
      flex: 1,
    },
    radiusChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: Colors.borderLight,
    },
    radiusChipActive: {
      backgroundColor: Colors.accent + '25',
    },
    radiusChipText: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: '500',
    },
    radiusChipTextActive: {
      color: Colors.accent,
      fontWeight: '700',
    },
    map: {
      flex: 1,
    },
  });
