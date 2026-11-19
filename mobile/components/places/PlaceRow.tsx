import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import type { PlaceSummary } from '../../services/places';
import { formatKm, kindMeta, placeSubtitle } from '../../utils/places';
import { haptics } from '../../utils/haptics';

interface PlaceRowProps {
  place: PlaceSummary;
  /** A number badge instead of the kind's icon (a route's stops). */
  number?: number;
  onPress?: () => void;
}

/** A place in a list: its kind, name, region and height, and how far it is when known. */
export function PlaceRow({ place, number, onPress }: PlaceRowProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const meta = kindMeta(place.kind);
  const open =
    onPress ??
    (() => {
      haptics.tap();
      router.push(`/trail/places/${place.id}` as never);
    });

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={open}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${place.name_en}, ${placeSubtitle(place)}${place.distance_km != null ? `, ${formatKm(place.distance_km)} away` : ''}`}
      testID={`place-row-${place.id}`}
    >
      <View style={styles.badge}>
        {number != null ? <Text style={styles.number}>{number}</Text> : <Icon name={meta.icon} size={20} color={Colors.primary} />}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name_en}
        </Text>
        {place.name_ka && place.name_ka !== place.name_en ? (
          <Text style={styles.local} numberOfLines={1}>
            {place.name_ka}
          </Text>
        ) : null}
        <Text style={styles.meta} numberOfLines={1}>
          {placeSubtitle(place)}
        </Text>
      </View>
      {place.distance_km != null ? <Text style={styles.distance}>{formatKm(place.distance_km)}</Text> : null}
      <Icon name="chevron-forward" size={16} color={Colors.textLight} />
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    badge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '14',
    },
    number: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.primary,
    },
    body: {
      flex: 1,
      gap: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    local: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    meta: {
      fontSize: 12,
      color: Colors.textLight,
    },
    distance: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });
