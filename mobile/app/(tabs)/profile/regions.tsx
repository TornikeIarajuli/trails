import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useRegionProgress } from '../../../hooks/useRegionProgress';
import { useTrails } from '../../../hooks/useTrails';
import { useSettingsStore } from '../../../store/settingsStore';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TrailCover } from '../../../components/trail/TrailCover';
import { RegionProgress } from '../../../types/regions';
import { getErrorStatus } from '../../../utils/showError';
import { localName } from '../../../utils/i18n';
import { toLatLng } from '../../../utils/mapPoint';
import {
  filterTrailsToRegion,
  progressColors,
  progressRatio,
  regionFraction,
  regionsHeaderText,
  sortRegions,
} from '../../../utils/regionProgress';

const GEORGIA = { latitude: 42.2, longitude: 43.5, latitudeDelta: 3.2, longitudeDelta: 6.5 };
const MAP_HEIGHT = 240;

function RegionMarker({ region, onPress }: { region: RegionProgress; onPress: () => void }) {
  const coordinate = region.center ? toLatLng({ coordinates: region.center }) : null;
  const colors = progressColors(region.completed, region.total);
  const label = regionFraction(region);
  // Custom marker views are re-rendered on every map frame while tracked; draw once, then stop
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(timer);
  }, [label, colors.background]);

  if (!coordinate) return null;
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={onPress}
      accessibilityLabel={`${region.region}: ${region.completed} of ${region.total} trails`}
    >
      <View style={[markerStyles.bubble, { backgroundColor: colors.background }]}>
        <Text style={[markerStyles.text, { color: colors.text }]}>{label}</Text>
      </View>
    </Marker>
  );
}

function RegionTrailList({
  region,
  completedIds,
  styles,
  Colors,
}: {
  region: string;
  completedIds: Set<string>;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const language = useSettingsStore((s) => s.language);
  const params = useMemo(() => ({ region, limit: 100 }), [region]);
  const { data, isLoading, isError, error, refetch, isRefetching } = useTrails(params);

  const trails = useMemo(() => {
    const inRegion = filterTrailsToRegion(data?.pages[0]?.data ?? [], region);
    // Hiked trails first
    return [...inRegion].sort((a, b) => Number(completedIds.has(b.id)) - Number(completedIds.has(a.id)));
  }, [data, region, completedIds]);

  if (isLoading) return <ActivityIndicator style={styles.trailsLoading} color={Colors.primary} />;
  if (isError && trails.length === 0) {
    return (
      <ErrorState
        compact
        error={error}
        message="Couldn't load this region's trails."
        onRetry={() => refetch()}
        retrying={isRefetching}
        style={styles.trailsError}
      />
    );
  }
  if (trails.length === 0) return <Text style={styles.noTrails}>No trails listed in this region.</Text>;

  return (
    <View style={styles.trails}>
      {trails.map((trail) => {
        const done = completedIds.has(trail.id);
        const name = localName(trail.name_en, trail.name_ka, language);
        return (
          <TouchableOpacity
            key={trail.id}
            style={styles.trailRow}
            onPress={() => router.push(`/trail/${trail.id}` as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${name}${done ? ', completed' : ''}`}
          >
            <TrailCover uri={trail.cover_image_url} style={styles.trailThumb} iconSize={18} />
            <Text style={styles.trailName} numberOfLines={1}>{name}</Text>
            {done ? (
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            ) : (
              <Ionicons name="ellipse-outline" size={20} color={Colors.border} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RegionRow({
  region,
  expanded,
  onToggle,
  styles,
  Colors,
}: {
  region: RegionProgress;
  expanded: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const ratio = progressRatio(region.completed, region.total);
  const colors = progressColors(region.completed, region.total);
  const completedIds = useMemo(() => new Set(region.completed_trail_ids ?? []), [region.completed_trail_ids]);

  return (
    <View style={styles.regionCard}>
      <TouchableOpacity
        style={styles.regionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${region.region}, ${region.completed} of ${region.total} trails completed`}
      >
        <View style={styles.regionText}>
          <View style={styles.regionTitleRow}>
            <Text style={styles.regionName} numberOfLines={1}>{region.region}</Text>
            <Text style={styles.regionFraction}>{regionFraction(region)}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.background },
              ]}
            />
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textLight} />
      </TouchableOpacity>
      {expanded && (
        <RegionTrailList region={region.region} completedIds={completedIds} styles={styles} Colors={Colors} />
      )}
    </View>
  );
}

export default function RegionsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { data, isLoading, error, refetch, isRefetching } = useRegionProgress(userId || undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<FlatList<RegionProgress>>(null);

  const regions = useMemo(() => sortRegions(data?.regions ?? []), [data]);

  const showRegion = useCallback(
    (name: string) => {
      setExpanded(name);
      const index = regions.findIndex((r) => r.region === name);
      if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
    },
    [regions],
  );

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: userId ? 'Regions explored' : 'My Georgia',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (!data) {
    if (isLoading) {
      return (
        <>
          {header}
          <View style={styles.container}>
            <Skeleton height={18} widthPercent="70%" style={styles.skeletonTitle} />
            <Skeleton height={MAP_HEIGHT} borderRadius={0} />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={56} borderRadius={12} style={styles.skeletonRow} />
            ))}
          </View>
        </>
      );
    }
    const notYet = getErrorStatus(error) === 404;
    return (
      <>
        {header}
        <ErrorState
          error={error}
          title={notYet ? 'Not available yet' : "Couldn't load your regions"}
          message={notYet ? 'Progress by region will appear after the next server update.' : undefined}
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <View style={styles.container}>
        <Text style={styles.summary}>{regionsHeaderText(data.totals)}</Text>

        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={GEORGIA}
            toolbarEnabled={false}
          >
            {regions.map((region) => (
              <RegionMarker key={region.region} region={region} onPress={() => showRegion(region.region)} />
            ))}
          </MapView>
        </View>

        <FlatList
          ref={listRef}
          data={regions}
          keyExtractor={(r) => r.region}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RegionRow
              region={item}
              expanded={expanded === item.region}
              onToggle={() => setExpanded(expanded === item.region ? null : item.region)}
              styles={styles}
              Colors={Colors}
            />
          )}
          onScrollToIndexFailed={(info) => {
            // Rows have different heights; jump close, then try again once laid out
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0, animated: true });
            }, 250);
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={<Text style={styles.noTrails}>No regions to show yet.</Text>}
        />
      </View>
    </>
  );
}

const markerStyles = StyleSheet.create({
  bubble: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
  },
});

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    summary: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    mapWrap: { height: MAP_HEIGHT },
    list: { padding: 16, gap: 10 },
    skeletonTitle: { marginHorizontal: 16, marginVertical: 14 },
    skeletonRow: { marginHorizontal: 16, marginTop: 10 },
    regionCard: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    regionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    regionText: { flex: 1, gap: 8 },
    regionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    regionName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
    regionFraction: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.borderLight,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    trails: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      paddingVertical: 4,
    },
    trailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    trailThumb: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden' },
    trailName: { flex: 1, fontSize: 14, color: Colors.text },
    trailsLoading: { paddingVertical: 16 },
    trailsError: { margin: 12 },
    noTrails: { fontSize: 13, color: Colors.textLight, padding: 14 },
  });
