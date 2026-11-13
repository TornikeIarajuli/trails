import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useColors } from '../../constants/colors';
import { TrailSummary } from '../../types/trail';
import { toLatLng } from '../../utils/mapPoint';
import { clusterPoints, MapRegion, regionForPoints } from '../../utils/mapClusters';
import { haptics } from '../../utils/haptics';

interface TrailClusterMapProps {
  trails: TrailSummary[];
  /** Read once; remount the map (change its `key`) to move it somewhere else. */
  initialRegion: MapRegion;
  onOpenTrail: (trailId: string) => void;
}

type TrailPoint = { id: string; latitude: number; longitude: number; trail: TrailSummary };

function ClusterBubble({ count, onPress, coordinate, color }: {
  count: number;
  onPress: () => void;
  coordinate: { latitude: number; longitude: number };
  color: string;
}) {
  // A custom marker view is redrawn on every map frame while tracked; draw it, then stop
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), 500);
    return () => clearTimeout(timer);
  }, [count, color]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={onPress}
      accessibilityLabel={`${count} trails here. Zoom in`}
    >
      <View style={[styles.bubble, { backgroundColor: color }]}>
        <Text style={styles.bubbleText}>{count}</Text>
      </View>
    </Marker>
  );
}

/**
 * The Explore map: one pin per trail, with pins that would overlap at the current
 * zoom grouped into a numbered bubble. Tapping a bubble zooms in on its trails.
 */
export function TrailClusterMap({ trails, initialRegion, onOpenTrail }: TrailClusterMapProps) {
  const Colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<MapRegion>(initialRegion);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const points = useMemo(
    () =>
      trails.flatMap((trail): TrailPoint[] => {
        const coord = toLatLng(trail.start_point);
        return coord ? [{ id: trail.id, latitude: coord.latitude, longitude: coord.longitude, trail }] : [];
      }),
    [trails],
  );

  const clusters = useMemo(
    () => clusterPoints(points, region, size.width, size.height),
    [points, region, size],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const zoomInto = (members: TrailPoint[]) => {
    haptics.tap();
    const target = regionForPoints(members);
    if (target) mapRef.current?.animateToRegion(target, 350);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        // Regroup only once the camera stops moving
        onRegionChangeComplete={(next: Region) => setRegion(next)}
      >
        {clusters.map((cluster) => {
          if (cluster.points.length > 1) {
            return (
              <ClusterBubble
                key={cluster.key}
                count={cluster.points.length}
                coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                color={Colors.primary}
                onPress={() => zoomInto(cluster.points)}
              />
            );
          }
          const { trail, latitude, longitude } = cluster.points[0];
          return (
            <Marker
              key={cluster.key}
              coordinate={{ latitude, longitude }}
              pinColor={Colors.difficulty[trail.difficulty]}
              title={trail.name_en}
              description={[trail.difficulty, trail.distance_km != null ? `${trail.distance_km} km` : null]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => onOpenTrail(trail.id)}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bubble: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
