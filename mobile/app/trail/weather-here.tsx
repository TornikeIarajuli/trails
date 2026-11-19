import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/Icon';
import { ErrorState } from '../../components/ui/ErrorState';
import { ForecastCard } from '../../components/weather/ForecastCard';
import { PlaceRow } from '../../components/places/PlaceRow';
import { useColors, ColorPalette } from '../../constants/colors';
import { useForecast } from '../../hooks/useForecast';
import { useNearbyPlaces } from '../../hooks/usePlaces';
import { getWeatherInfo } from '../../services/weather';
import { degrees } from '../../utils/trailVerdict';
import { formatCoordinates } from '../../utils/directions';
import { withBottomInset } from '../../utils/insets';

type Status = 'locating' | 'denied' | 'off' | 'ready';

/** A fix this recent is good enough for the weather: no wait for the GPS. */
const RECENT_FIX_MS = 10 * 60 * 1000;

/** About 100 m: the forecast doesn't change within it, and the exact spot stays on the phone. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The weather where you stand: today hour by hour and the week ahead, scored for hiking,
 * camping, fishing, photos, stars, 4×4, running or climbing, and the places around you.
 */
export default function WeatherHereScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>('locating');
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus('locating');
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (permission !== 'granted') {
          if (alive) setStatus('denied');
          return;
        }
        const recent = await Location.getLastKnownPositionAsync({ maxAge: RECENT_FIX_MS }).catch(() => null);
        const position = recent ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!alive) return;
        const point = { latitude: round3(position.coords.latitude), longitude: round3(position.coords.longitude) };
        setHere(point);
        setStatus('ready');
        // The town or district by name, from the phone's own geocoder; the coordinates do without it
        Location.reverseGeocodeAsync(point)
          .then(([address]) => {
            if (alive && address) setPlaceName(address.city ?? address.district ?? address.subregion ?? address.region ?? null);
          })
          .catch(() => {});
      } catch {
        if (alive) setStatus('off');
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const point = useMemo(() => (here ? { ...here, elevationM: null } : null), [here]);
  const forecast = useForecast('here', point);
  const nearby = useNearbyPlaces(here, { radiusKm: 30, limit: 6 });
  const data = forecast.data;
  const elevation = data?.elevationM != null ? `${Math.round(data.elevationM).toLocaleString('en-US')} m` : null;
  const current = data?.current;
  const nowLine =
    current?.tempC != null
      ? `Now: ${degrees(current.tempC)}` +
        (current.feelsC != null ? ` (feels ${degrees(current.feelsC)})` : '') +
        (current.weathercode != null ? `, ${getWeatherInfo(current.weathercode).label.toLowerCase()}` : '') +
        (current.windKmh != null ? `, wind ${Math.round(current.windKmh)} km/h` : '')
      : null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Weather here',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      {status === 'locating' ? (
        <View style={styles.center} testID="weather-here-locating">
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.centerText}>Finding where you are…</Text>
        </View>
      ) : status === 'denied' || status === 'off' ? (
        <View style={styles.center} testID={`weather-here-${status}`}>
          <Icon name="location-outline" size={40} color={Colors.textLight} />
          <Text style={styles.centerTitle}>{status === 'denied' ? 'Location is off for Kvali' : "Couldn't find where you are"}</Text>
          <Text style={styles.centerText}>
            {status === 'denied'
              ? 'Allow location to see the weather where you are. Kvali sends the forecast service only rounded coordinates.'
              : 'Check that location is switched on, then try again.'}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button" testID="weather-here-retry">
              <Text style={styles.primaryText}>Try again</Text>
            </TouchableOpacity>
            {status === 'denied' ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button">
                <Text style={styles.secondaryText}>Open settings</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={withBottomInset(styles.content, insets.bottom)}
          refreshControl={
            <RefreshControl
              refreshing={forecast.isRefetching}
              onRefresh={() => forecast.refetch()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          <View style={styles.where} accessible>
            <Icon name="navigate-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.whereTitle}>{placeName ?? 'Where you are'}</Text>
              <Text style={styles.whereMeta}>
                {here ? formatCoordinates(here) : ''}
                {elevation ? ` · ${elevation}` : ''}
              </Text>
            </View>
          </View>

          {forecast.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : forecast.isError && !data ? (
            <ErrorState error={forecast.error} title="Couldn't load the forecast" onRetry={() => forecast.refetch()} retrying={forecast.isRefetching} />
          ) : here ? (
            <ForecastCard
              forecast={data}
              latitude={here.latitude}
              longitude={here.longitude}
              where={elevation ? `at ${elevation}` : 'here'}
              title="Weather here"
              topM={data?.elevationM ?? null}
              nowLine={nowLine}
              sourcePlace="where you are"
              tempLabel="Temperature"
              testID="weather-here-forecast"
            />
          ) : null}

          {nearby.data && nearby.data.data.length > 0 ? (
            <View style={styles.section} testID="weather-here-places">
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Places near you</Text>
                <TouchableOpacity onPress={() => router.push('/trail/places' as never)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.seeAll}>All places</Text>
                </TouchableOpacity>
              </View>
              {nearby.data.data.map((p) => (
                <PlaceRow key={p.id} place={p} />
              ))}
            </View>
          ) : null}
        </ScrollView>
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
    content: {
      paddingTop: 8,
      gap: 16,
      paddingBottom: 16,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 32,
    },
    centerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: Colors.text,
      textAlign: 'center',
    },
    centerText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    primaryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: Colors.primary,
    },
    primaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    secondaryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    where: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
    },
    whereTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
    },
    whereMeta: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    section: {
      gap: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
  });
