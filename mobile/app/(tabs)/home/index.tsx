import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrails, useRegions, useNearbyTrails, usePrefetchTrail } from '../../../hooks/useTrails';
import { useDebounce } from '../../../hooks/useDebounce';
import { TrailCard } from '../../../components/trail/TrailCard';
import { TrailFilters } from '../../../components/trail/TrailFilters';
import { TrailClusterMap } from '../../../components/trail/TrailClusterMap';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ActiveHikeBanner } from '../../../components/hike/ActiveHikeBanner';
import { TrailDifficulty, TrailSummary } from '../../../types/trail';
import { TrailCardSkeleton } from '../../../components/ui/Skeleton';
import { Config } from '../../../constants/config';
import { haptics } from '../../../utils/haptics';

const RADIUS_OPTIONS = [5, 15, 25] as const;
type Radius = (typeof RADIUS_OPTIONS)[number];
const KM_PER_DEGREE_LATITUDE = 111;

export default function HomeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [nearbyMode, setNearbyMode] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radius, setRadius] = useState<Radius>(15);
  const [nearbyVersion, setNearbyVersion] = useState(0);
  const debouncedSearch = useDebounce(search, 300);
  const prefetchTrail = usePrefetchTrail();

  const { data: regions } = useRegions();

  const params = useMemo(
    () => ({
      ...(difficulty && { difficulty }),
      ...(region && { region }),
      ...(debouncedSearch && { search: debouncedSearch }),
      limit: viewMode === 'map' ? 500 : 20, // the map shows every published trail (API maximum 500)
    }),
    [difficulty, region, debouncedSearch, viewMode],
  );

  // The full list is not shown in Near Me mode, so it is not fetched there either
  const trailsQuery = useTrails(params, !nearbyMode);

  const nearbyQuery = useNearbyTrails(
    nearbyMode ? userLocation?.latitude : undefined,
    nearbyMode ? userLocation?.longitude : undefined,
    nearbyMode ? radius : undefined,
    nearbyMode ? nearbyVersion : undefined,
  );

  const listTrails = useMemo(() => {
    const all = trailsQuery.data?.pages.flatMap((page) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [trailsQuery.data]);

  // The nearby endpoint takes no filters, so search and difficulty are applied here
  const nearbyTrails = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return (nearbyQuery.data ?? []).filter(
      (t) =>
        (!difficulty || t.difficulty === difficulty) &&
        (!query ||
          t.name_en?.toLowerCase().includes(query) ||
          !!t.name_ka?.toLowerCase().includes(query)),
    );
  }, [nearbyQuery.data, debouncedSearch, difficulty]);

  const trails: TrailSummary[] = nearbyMode ? nearbyTrails : listTrails;
  const activeQuery = nearbyMode ? nearbyQuery : trailsQuery;
  const loading = activeQuery.isLoading;
  const failed = activeQuery.isError && (nearbyMode ? !nearbyQuery.data : listTrails.length === 0);
  const refreshing = activeQuery.isRefetching && !trailsQuery.isFetchingNextPage;
  const nearbyFiltersActive = !!difficulty || debouncedSearch.trim().length > 0;
  const listFiltersActive = nearbyFiltersActive || !!region;
  // For the filter sheet's "Show N trails": the list's full total (not just the loaded
  // pages), or in Near Me everything that is shown
  const resultCount = nearbyMode
    ? (nearbyQuery.data ? nearbyTrails.length : null)
    : (trailsQuery.data?.pages[0]?.pagination.total ?? null);

  const clearFilters = () => {
    setSearch('');
    setDifficulty(null);
    setRegion(null);
  };

  // The sheet's "Clear all" leaves the search alone: the search bar is outside the sheet
  const clearSheetFilters = () => {
    setDifficulty(null);
    setRegion(null);
  };

  const handleNearbyToggle = useCallback(async () => {
    if (locating) return;
    if (nearbyMode) {
      setNearbyMode(false);
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Please allow location access to find trails near you.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setNearbyVersion((v) => v + 1); // force React Query to treat this as a new request
      setNearbyMode(true);
    } catch {
      // If a fresh fix fails but we have an earlier one, reuse it
      if (userLocation) {
        setNearbyVersion((v) => v + 1);
        setNearbyMode(true);
      } else {
        Alert.alert('Location error', 'Could not get your location. Please try again.');
      }
    } finally {
      setLocating(false);
    }
  }, [locating, nearbyMode, userLocation]);

  const renderEmpty = () => {
    if (nearbyMode && (nearbyQuery.data?.length ?? 0) > 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="funnel-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No nearby trails match your filters</Text>
          <TouchableOpacity style={styles.emptyAction} onPress={clearFilters} accessibilityRole="button">
            <Text style={styles.emptyActionText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (nearbyMode) {
      return (
        <View style={styles.empty}>
          <Ionicons name="map-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No trails within {radius} km</Text>
          {radius < 25 && (
            <TouchableOpacity style={styles.emptyAction} onPress={() => setRadius(25)} accessibilityRole="button">
              <Text style={styles.emptyActionText}>Expand to 25 km</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Ionicons name="map-outline" size={48} color={Colors.textLight} />
        <Text style={styles.emptyText}>No trails found</Text>
        {listFiltersActive && (
          <TouchableOpacity style={styles.emptyAction} onPress={clearFilters} accessibilityRole="button">
            <Text style={styles.emptyActionText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const nearbyDelta = ((radius * 2) / KM_PER_DEGREE_LATITUDE) * 1.3;

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
        // The nearby endpoint takes no region, so Near Me ignores it (and keeps it for later)
        regionNote={nearbyMode ? `Near Me shows trails within ${radius} km of you, in any region.` : null}
        onClearAll={clearSheetFilters}
        resultCount={resultCount}
        resultsLoading={activeQuery.isLoading}
      />

      {/* Modes and shortcuts, not filters: Near Me (with its radius below) and Map change
          how trails are found and shown, so they stay one tap away instead of in the sheet */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickActions}
        contentContainerStyle={styles.quickActionsContent}
      >
        <TouchableOpacity
          style={[styles.quickChip, nearbyMode && styles.quickChipActive]}
          onPress={() => {
            haptics.select();
            handleNearbyToggle();
          }}
          disabled={locating}
          accessibilityLabel={
            locating
              ? 'Finding your location'
              : nearbyMode
                ? 'Disable nearby trails'
                : 'Find trails near me'
          }
          accessibilityRole="button"
          accessibilityState={{ busy: locating, selected: nearbyMode }}
        >
          {locating ? (
            <ActivityIndicator size="small" color={Colors.textSecondary} />
          ) : (
            <Ionicons
              name={nearbyMode ? 'navigate' : 'navigate-outline'}
              size={16}
              color={nearbyMode ? Colors.accent : Colors.textSecondary}
            />
          )}
          <Text style={[styles.quickChipText, nearbyMode && styles.quickChipTextActive]}>Near Me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickChip, viewMode === 'map' && styles.quickChipActive]}
          onPress={() => {
            haptics.select();
            setViewMode(viewMode === 'map' ? 'list' : 'map');
          }}
          accessibilityLabel={viewMode === 'map' ? 'Switch to list view' : 'Switch to map view'}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'map' }}
          testID={viewMode === 'map' ? 'list-toggle' : 'map-toggle'}
        >
          <Ionicons
            name={viewMode === 'map' ? 'map' : 'map-outline'}
            size={16}
            color={viewMode === 'map' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.quickChipText, viewMode === 'map' && styles.quickChipTextActive]}>Map</Text>
        </TouchableOpacity>

        {/* Opened on the root stack so Back returns here, not to the Profile tab */}
        <TouchableOpacity
          style={styles.quickChip}
          onPress={() => {
            haptics.tap();
            router.push('/trail/bookmarks');
          }}
          accessibilityLabel="My bookmarks"
          accessibilityRole="button"
        >
          <Ionicons name="bookmark-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.quickChipText}>Bookmarks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickChip}
          onPress={() => {
            haptics.tap();
            router.push('/trail/recommendations');
          }}
          accessibilityLabel="Trail recommendations for you"
          accessibilityRole="button"
        >
          <Ionicons name="compass-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.quickChipText}>For You</Text>
        </TouchableOpacity>
      </ScrollView>

      {locating && (
        <View style={styles.toolbar}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.locatingText}>Finding your location…</Text>
        </View>
      )}

      {/* Toolbar: radius chips when nearby mode is active */}
      {nearbyMode && !locating && (
        <View style={styles.toolbar}>
          <View style={styles.radiusChips}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.radiusChip, radius === r && styles.radiusChipActive]}
                onPress={() => {
                  haptics.select();
                  setRadius(r);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Within ${r} kilometres`}
                accessibilityState={{ selected: radius === r }}
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
        <View style={styles.list}>
          {Array.from({ length: 5 }).map((_, i) => <TrailCardSkeleton key={i} />)}
        </View>
      ) : failed ? (
        <ErrorState
          error={activeQuery.error}
          title="Couldn't load trails"
          onRetry={() => activeQuery.refetch()}
          retrying={activeQuery.isRefetching}
        />
      ) : viewMode === 'list' ? (
        <FlatList
          data={trails}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <TrailCard trail={item} index={index} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          onEndReached={() => {
            if (!nearbyMode && trailsQuery.hasNextPage && !trailsQuery.isFetchingNextPage) {
              trailsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => activeQuery.refetch()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={renderEmpty()}
          ListFooterComponent={
            !nearbyMode && trailsQuery.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={Colors.primary} />
            ) : null
          }
        />
      ) : (
        <TrailClusterMap
          // Remount when the centre changes: `initialRegion` is only read once
          key={
            nearbyMode && userLocation
              ? `near-${userLocation.latitude}-${userLocation.longitude}-${radius}`
              : 'all'
          }
          trails={trails}
          initialRegion={
            nearbyMode && userLocation
              ? { ...userLocation, latitudeDelta: nearbyDelta, longitudeDelta: nearbyDelta }
              : Config.DEFAULT_MAP_REGION
          }
          onOpenTrail={(trailId) => {
            prefetchTrail(trailId);
            haptics.tap();
            router.push(`/trail/${trailId}` as any);
          }}
        />
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
    footer: {
      paddingVertical: 16,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 16,
      color: Colors.textLight,
      marginTop: 12,
      textAlign: 'center',
    },
    emptyAction: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: Colors.primary + '15',
      borderWidth: 1,
      borderColor: Colors.primary + '40',
    },
    emptyActionText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    // A horizontal ScrollView defaults to flexShrink: 1, so the list below squeezed
    // this row and cut off the bottom of the chips; it must keep its full height.
    quickActions: {
      flexGrow: 0,
      flexShrink: 0,
    },
    quickActionsContent: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    quickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 11,   // 16px icon + 11*2 padding = 38px → with border = ~44px
      minHeight: 44,
      borderRadius: 22,
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
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    locatingText: {
      fontSize: 13,
      color: Colors.textSecondary,
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
