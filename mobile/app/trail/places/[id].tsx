import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ForecastCard } from '../../../components/weather/ForecastCard';
import { DirectionsRow } from '../../../components/trail/DirectionsRow';
import { DifficultyBadge } from '../../../components/trail/DifficultyBadge';
import { PlaceRow } from '../../../components/places/PlaceRow';
import { PlacesMap } from '../../../components/places/PlacesMap';
import { useColors, ColorPalette } from '../../../constants/colors';
import { usePlace } from '../../../hooks/usePlaces';
import { useForecast } from '../../../hooks/useForecast';
import type { PlaceDetail } from '../../../services/places';
import type { TrailDifficulty } from '../../../types/trail';
import { activitiesFor, defaultActivity, formatKm, kindMeta, osmUrl, visitFacts, wikipediaUrl } from '../../../utils/places';
import { formatCoordinates } from '../../../utils/directions';
import { degrees } from '../../../utils/trailVerdict';
import { getErrorStatus } from '../../../utils/showError';
import { withBottomInset } from '../../../utils/insets';
import { haptics } from '../../../utils/haptics';

const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'ultra']);

/**
 * A place: where it is, the way there, its weather scored for what people do there, and the
 * trails and places around it.
 */
export default function PlaceScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = usePlace(typeof id === 'string' ? id : undefined);
  const place = query.data;
  const point = useMemo(
    () => (place ? { latitude: place.latitude, longitude: place.longitude, elevationM: place.elevation_m } : null),
    [place],
  );
  const forecast = useForecast(`place:${place?.id ?? ''}`, point);

  const screen = (title: string) => (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        {screen('')}
        <LoadingSpinner />
      </View>
    );
  }
  if (!place) {
    const gone = getErrorStatus(query.error) === 404;
    return (
      <View style={styles.container}>
        {screen('')}
        <ErrorState
          error={query.error}
          title={gone ? 'This place is not on Kvali' : "Couldn't load this place"}
          message={gone ? 'It may have been merged with another or removed from the map.' : undefined}
          onRetry={gone ? undefined : () => query.refetch()}
          retrying={query.isRefetching}
        />
      </View>
    );
  }

  const meta = kindMeta(place.kind);
  const wiki = wikipediaUrl(place.wikipedia);
  const facts = visitFacts(place.tags);
  const elevation = place.elevation_m != null ? `${Math.round(place.elevation_m).toLocaleString('en-US')} m` : null;
  const current = forecast.data?.current;

  return (
    <View style={styles.container}>
      {screen(place.name_en)}
      <ScrollView
        contentContainerStyle={withBottomInset(styles.content, insets.bottom)}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              query.refetch();
              forecast.refetch();
            }}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.titleBlock}>
          <View style={styles.kindRow}>
            <Icon name={meta.icon} size={16} color={Colors.primary} />
            <Text style={styles.kind}>
              {meta.label}
              {place.region ? ` · ${place.region}` : ''}
            </Text>
          </View>
          <Text style={styles.name} testID="place-name">
            {place.name_en}
          </Text>
          {place.name_ka && place.name_ka !== place.name_en ? <Text style={styles.localName}>{place.name_ka}</Text> : null}
        </View>

        <PlacesMap
          points={[{ id: place.id, latitude: place.latitude, longitude: place.longitude, title: place.name_en, description: meta.label }]}
          height={220}
        />

        <View style={styles.facts}>
          {elevation ? <Fact label="Height" value={elevation} styles={styles} /> : null}
          <Fact label="Coordinates" value={formatCoordinates(place)} styles={styles} />
          {facts.map((f) => (
            <Fact key={f.label} label={f.label} value={f.value} styles={styles} />
          ))}
        </View>

        <DirectionsRow trailId={place.id} trailName={place.name_en} start={place} isPlace />

        {forecast.data ? (
          <ForecastCard
            forecast={forecast.data}
            latitude={place.latitude}
            longitude={place.longitude}
            where={elevation ? `at ${elevation}` : 'here'}
            title="Weather"
            topM={place.elevation_m}
            activities={activitiesFor(place)}
            defaultActivity={defaultActivity(place)}
            nowLine={
              current?.tempC != null
                ? `Now: ${degrees(current.tempC)}${current.feelsC != null ? ` (feels ${degrees(current.feelsC)})` : ''}`
                : null
            }
            sourcePlace={`${place.name_en}${elevation ? ` at ${elevation}` : ''}`}
            tempLabel="Temperature"
            testID="place-forecast"
          />
        ) : forecast.isError ? (
          <ErrorState compact error={forecast.error} title="Couldn't load the forecast" onRetry={() => forecast.refetch()} />
        ) : null}

        <NearbyTrails place={place} styles={styles} Colors={Colors} />

        {place.nearby_places.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nearby places</Text>
            {place.nearby_places.map((p) => (
              <PlaceRow key={p.id} place={p} />
            ))}
          </View>
        ) : null}

        <View style={styles.links}>
          {wiki ? (
            <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(wiki).catch(() => {})} accessibilityRole="link">
              <Icon name="globe-outline" size={16} color={Colors.primary} />
              <Text style={styles.linkText}>Read about it on Wikipedia</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.link}
            onPress={() => Linking.openURL(osmUrl(place.osm_type, place.osm_id)).catch(() => {})}
            accessibilityRole="link"
          >
            <Icon name="map-outline" size={16} color={Colors.primary} />
            <Text style={styles.linkText}>See or fix it on OpenStreetMap</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.source}>
          Place data © OpenStreetMap contributors. Paths to it may be rough or seasonal: check before you go.
        </Text>
      </ScrollView>
    </View>
  );
}

function NearbyTrails({ place, styles, Colors }: { place: PlaceDetail; styles: Styles; Colors: ColorPalette }) {
  if (place.nearby_trails.length === 0) return null;
  return (
    <View style={styles.section} testID="place-nearby-trails">
      <Text style={styles.sectionTitle}>Trails nearby</Text>
      {place.nearby_trails.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={styles.trailRow}
          onPress={() => {
            haptics.tap();
            router.push(`/trail/${t.id}` as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t.name_en}, ${formatKm(t.distance_km)} away`}
          testID={`place-trail-${t.id}`}
        >
          <Icon name="trail-sign-outline" size={20} color={Colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.trailName} numberOfLines={1}>
              {t.name_en}
            </Text>
            <View style={styles.trailMeta}>
              {t.difficulty && DIFFICULTIES.has(t.difficulty) ? <DifficultyBadge difficulty={t.difficulty as TrailDifficulty} /> : null}
              <Text style={styles.trailMetaText}>{formatKm(t.distance_km)} from here</Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={16} color={Colors.textLight} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Fact({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingTop: 8,
      gap: 16,
      paddingBottom: 24,
    },
    titleBlock: {
      paddingHorizontal: 16,
      gap: 2,
    },
    kindRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    kind: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    name: {
      fontSize: 24,
      fontWeight: '800',
      color: Colors.text,
    },
    localName: {
      fontSize: 15,
      color: Colors.textSecondary,
    },
    facts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
    },
    fact: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    factLabel: {
      fontSize: 11,
      color: Colors.textLight,
    },
    factValue: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.text,
      fontVariant: ['tabular-nums'],
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
      paddingHorizontal: 16,
    },
    trailRow: {
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
    trailName: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    trailMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    trailMetaText: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    links: {
      gap: 4,
      paddingHorizontal: 16,
    },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    linkText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    source: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textLight,
      paddingHorizontal: 16,
    },
  });
