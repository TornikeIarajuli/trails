import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { useNearbyPlaces } from '../../hooks/usePlaces';
import { PlaceRow } from './PlaceRow';

interface NearbyPlacesProps {
  near: { latitude: number; longitude: number } | null;
  title?: string;
  radiusKm?: number;
  limit?: number;
}

/** The lakes, waterfalls, fortresses… around a point, nearest first; nothing when there are none. */
export function NearbyPlaces({ near, title = 'Places nearby', radiusKm = 15, limit = 5 }: NearbyPlacesProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data } = useNearbyPlaces(near, { radiusKm, limit });
  const places = data?.data ?? [];
  if (places.length === 0) return null;

  return (
    <View style={styles.section} testID="nearby-places">
      <Text style={styles.title}>{title}</Text>
      {places.map((p) => (
        <PlaceRow key={p.id} place={p} />
      ))}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    section: {
      gap: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
      paddingHorizontal: 16,
    },
  });
