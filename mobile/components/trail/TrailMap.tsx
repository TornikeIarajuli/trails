import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useColors, ColorPalette } from '../../constants/colors';
import { Checkpoint } from '../../types/checkpoint';
import { parseGeoPoint } from '../../utils/geo';

interface TrailMapProps {
  route?: { latitude: number; longitude: number }[];
  checkpoints?: Checkpoint[];
  startPoint?: { latitude: number; longitude: number };
  endPoint?: { latitude: number; longitude: number };
  height?: number;
}

export function TrailMap({
  route = [],
  checkpoints = [],
  startPoint,
  endPoint,
  height = 250,
}: TrailMapProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  // Parse checkpoint coordinates
  const parsedCheckpoints = checkpoints
    .map((cp) => {
      const coord = parseGeoPoint(cp.coordinates);
      return coord ? { ...cp, coord } : null;
    })
    .filter(Boolean) as (Checkpoint & { coord: { latitude: number; longitude: number } })[];

  // Calculate region to fit all points
  const allPoints = [
    ...route,
    ...(startPoint ? [startPoint] : []),
    ...(endPoint ? [endPoint] : []),
    ...parsedCheckpoints.map((cp) => cp.coord),
  ];

  if (allPoints.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>No route data</Text>
      </View>
    );
  }

  const lats = allPoints.map((p) => p.latitude);
  const lngs = allPoints.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.5 || 0.01,
    longitudeDelta: (maxLng - minLng) * 1.5 || 0.01,
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
      >
        {route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeColor={Colors.primary}
            strokeWidth={3}
          />
        )}
        {startPoint && (
          <Marker coordinate={startPoint} title="Start" pinColor="green" />
        )}
        {endPoint && (
          <Marker coordinate={endPoint} title="End" pinColor="red" />
        )}
        {parsedCheckpoints.map((cp) => (
          <Marker
            key={cp.id}
            coordinate={cp.coord}
            title={cp.name_en}
            description={cp.type}
            pinColor={Colors.accent}
          />
        ))}
      </MapView>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  placeholderText: {
    color: Colors.textLight,
    fontSize: 14,
  },
});
