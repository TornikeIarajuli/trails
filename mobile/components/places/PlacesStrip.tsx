import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { usePlaces } from '../../hooks/usePlaces';
import type { PlaceSummary } from '../../services/places';
import { kindMeta } from '../../utils/places';
import { haptics } from '../../utils/haptics';

const SHOWN = 10;

/** Explore's "Places to see" row: Georgia's best-known lakes, waterfalls and fortresses, and the way to all places. */
export function PlacesStrip() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data } = usePlaces({});
  const places = data?.pages[0]?.data.slice(0, SHOWN) ?? [];

  if (places.length === 0) return null;

  return (
    <View style={styles.container} testID="places-strip">
      <View style={styles.header}>
        <Text style={styles.title}>Places to see</Text>
        <TouchableOpacity
          style={styles.seeAll}
          onPress={() => {
            haptics.tap();
            router.push('/trail/places' as never);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="See all places"
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Icon name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={places}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlaceCard place={item} styles={styles} Colors={Colors} />}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
        contentContainerStyle={styles.row}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

function PlaceCard({ place, styles, Colors }: { place: PlaceSummary; styles: ReturnType<typeof createStyles>; Colors: ColorPalette }) {
  const meta = kindMeta(place.kind);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        haptics.tap();
        router.push(`/trail/places/${place.id}` as never);
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${place.name_en}, ${meta.label}${place.region ? `, ${place.region}` : ''}`}
    >
      <View style={styles.iconWrap}>
        <Icon name={meta.icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {place.name_en}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {meta.label}
        {place.region ? ` · ${place.region}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      gap: 10,
      marginBottom: 16,
    },
    header: {
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
    },
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    row: {
      paddingHorizontal: 16,
    },
    card: {
      width: 140,
      padding: 12,
      gap: 6,
      borderRadius: 12,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '14',
    },
    name: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.text,
      minHeight: 36,
    },
    meta: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });
