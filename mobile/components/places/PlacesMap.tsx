import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, Platform, Linking, StyleProp, ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMapStyle } from '../../hooks/useMapStyle';
import { TopoTileLayer, mapTypeFor } from '../map/TopoTileLayer';
import { MapStylePicker } from '../map/MapStylePicker';
import { TopoAttribution } from '../map/TopoAttribution';

const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  /** A numbered pin (a route's stops) instead of the default pin. */
  number?: number;
}

interface PlacesMapProps {
  points: MapPoint[];
  /** A line through the points in order (a day route). */
  path?: { latitude: number; longitude: number }[];
  /** Tapping a pin's label. */
  onPressPoint?: (id: string) => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
}

/** The region that shows every point, with a margin; a single point gets a few kilometres around it. */
export function regionFor(points: { latitude: number; longitude: number }[]): Region | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.04),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.04),
  };
}

/** Places on the map (topo, satellite or standard, as on the trail map), refitted when they change. */
export function PlacesMap({ points, path, onPressPoint, height = 240, style, showsUserLocation }: PlacesMapProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { style: mapStyle, topo, offline, setStyle } = useMapStyle();
  const ref = useRef<MapView>(null);
  const region = useMemo(() => regionFor(points), [points]);
  const fitKey = points.map((p) => p.id).join(',');

  useEffect(() => {
    if (region) ref.current?.animateToRegion(region, 300);
    // Refit when the set of points changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  if (!region) return null;

  return (
    <View style={style}>
      <View style={[styles.container, { height }]}>
        <MapView
          ref={ref}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={region}
          mapType={mapTypeFor(mapStyle)}
          showsUserLocation={showsUserLocation}
          toolbarEnabled={false}
        >
          {topo && <TopoTileLayer offline={offline} />}
          {path && path.length > 1 ? <Polyline coordinates={path} strokeColor={Colors.primary} strokeWidth={3} lineDashPattern={[8, 6]} /> : null}
          {points.map((p) =>
            p.number != null ? (
              <Marker
                key={p.id}
                coordinate={p}
                title={p.title}
                description={p.description}
                onCalloutPress={onPressPoint ? () => onPressPoint(p.id) : undefined}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.numberPin}>
                  <Text style={styles.numberText}>{p.number}</Text>
                </View>
              </Marker>
            ) : (
              <Marker
                key={p.id}
                coordinate={p}
                title={p.title}
                description={p.description}
                pinColor={Colors.primary}
                onCalloutPress={onPressPoint ? () => onPressPoint(p.id) : undefined}
              />
            ),
          )}
        </MapView>
        <MapStylePicker value={mapStyle} onChange={setStyle} style={styles.toggle} />
        {topo && <TopoAttribution />}
      </View>
      {/* Places come from OpenStreetMap (ODbL), which requires this credit; the topo credit includes it */}
      {!topo && (
        <Text style={styles.attribution} onPress={() => Linking.openURL(OSM_COPYRIGHT_URL).catch(() => {})} accessibilityRole="link">
          Map data © OpenStreetMap contributors
        </Text>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      borderRadius: 12,
      overflow: 'hidden',
      marginHorizontal: 16,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    toggle: {
      position: 'absolute',
      top: 10,
      right: 10,
    },
    numberPin: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    numberText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    attribution: {
      fontSize: 11,
      color: Colors.textLight,
      textAlign: 'right',
      marginHorizontal: 16,
      marginTop: 4,
    },
  });
