import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { ErrorState } from '../../../components/ui/ErrorState';
import { PlaceRow } from '../../../components/places/PlaceRow';
import { PlacesMap } from '../../../components/places/PlacesMap';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useRegionPlaces } from '../../../hooks/usePlaces';
import { GUIDE_REGIONS } from '../../../utils/guides';
import { DayRoute, formatMinutes, planDayRoutes, routeDirectionsUrl } from '../../../utils/routePlanner';
import { kindMeta } from '../../../utils/places';
import { withBottomInset } from '../../../utils/insets';
import { haptics } from '../../../utils/haptics';

/** Where most first visits go for a day of sights: canyons, caves and waterfalls close together. */
const DEFAULT_REGION = 'Imereti';

/**
 * Day routes: a region's best-known sights a short drive apart, in the order that drives least,
 * on the map and in one tap in Google Maps.
 */
export default function DayRoutesScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ region?: string }>();
  const [region, setRegion] = useState<string>(
    typeof params.region === 'string' && GUIDE_REGIONS.includes(params.region as (typeof GUIDE_REGIONS)[number])
      ? params.region
      : DEFAULT_REGION,
  );
  const [selected, setSelected] = useState(0);
  const query = useRegionPlaces(region);
  const routes = useMemo(() => planDayRoutes(query.data?.data ?? []), [query.data]);
  useEffect(() => setSelected(0), [region]);
  const route: DayRoute | undefined = routes[Math.min(selected, routes.length - 1)];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Day routes',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={withBottomInset(styles.content, insets.bottom)}>
        <Text style={styles.intro}>
          A region&apos;s best-known sights a short drive apart, in the order that drives least. Open the route in Google Maps to
          drive it from where you are.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regions}>
          {GUIDE_REGIONS.map((r) => {
            const active = r === region;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  haptics.select();
                  setRegion(r);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`routes-region-${r}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {query.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
        ) : query.isError ? (
          <ErrorState error={query.error} title="Couldn't load the places" onRetry={() => query.refetch()} retrying={query.isRefetching} />
        ) : !route ? (
          <View style={styles.empty} testID="routes-empty">
            <Icon name="route" size={40} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No day route for {region} yet</Text>
            <Text style={styles.emptyText}>Its sights are too few or too far apart for one day. Try another region.</Text>
          </View>
        ) : (
          <>
            {routes.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeTabs}>
                {routes.map((r, i) => {
                  const active = r.id === route.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.routeTab, active && styles.routeTabActive]}
                      onPress={() => {
                        haptics.select();
                        setSelected(i);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      testID={`route-tab-${i}`}
                    >
                      <Text style={[styles.routeTabTitle, active && styles.routeTabTitleActive]} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={styles.routeTabMeta}>
                        {r.stops.length} stops · {r.driveKm} km
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            <PlacesMap
              points={route.stops.map((s, i) => ({
                id: s.id,
                latitude: s.latitude,
                longitude: s.longitude,
                title: `${i + 1}. ${s.name_en}`,
                description: kindMeta(s.kind).label,
                number: i + 1,
              }))}
              path={route.stops}
              onPressPoint={(id) => router.push(`/trail/places/${id}` as never)}
              height={260}
            />

            <View style={styles.card} testID="route-card">
              <Text style={styles.routeTitle}>{route.title}</Text>
              <Text style={styles.summary}>{route.summary}</Text>
              <View style={styles.statsRow}>
                <Stat icon="car-outline" value={`≈ ${route.driveKm} km`} label={`${formatMinutes(route.driveMinutes)} driving`} styles={styles} Colors={Colors} />
                <Stat icon="time-outline" value={formatMinutes(route.driveMinutes + route.visitMinutes)} label="with the stops" styles={styles} Colors={Colors} />
              </View>
              <TouchableOpacity
                style={styles.openButton}
                onPress={() => {
                  haptics.tap();
                  Linking.openURL(routeDirectionsUrl(route.stops)).catch(() => {});
                }}
                accessibilityRole="button"
                testID="route-open-maps"
              >
                <Icon name="navigate-outline" size={18} color={Colors.textOnPrimary} />
                <Text style={styles.openText}>Open the route in Google Maps</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stops}>
              {route.stops.map((s, i) => (
                <PlaceRow key={s.id} place={s} number={i + 1} />
              ))}
            </View>
            <Text style={styles.note}>
              Times are estimates: mountain roads wind, and some sights are a walk from the road. Check each place before you go.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Stat({
  icon,
  value,
  label,
  styles,
  Colors,
}: {
  icon: 'car-outline' | 'time-outline';
  value: string;
  label: string;
  styles: Styles;
  Colors: ColorPalette;
}) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value}, ${label}`}>
      <Icon name={icon} size={18} color={Colors.primary} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
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
      gap: 14,
      paddingBottom: 24,
    },
    intro: {
      paddingHorizontal: 16,
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    regions: {
      gap: 8,
      paddingHorizontal: 16,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
    },
    routeTabs: {
      gap: 8,
      paddingHorizontal: 16,
    },
    routeTab: {
      width: 170,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      gap: 2,
    },
    routeTabActive: {
      borderColor: Colors.primary,
      backgroundColor: Colors.primary + '10',
    },
    routeTabTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.textSecondary,
    },
    routeTabTitleActive: {
      color: Colors.text,
    },
    routeTabMeta: {
      fontSize: 12,
      color: Colors.textLight,
    },
    card: {
      marginHorizontal: 16,
      padding: 16,
      gap: 10,
      borderRadius: 14,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    routeTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: Colors.text,
    },
    summary: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 24,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: Colors.textLight,
    },
    openButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    openText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    stops: {
      gap: 8,
    },
    note: {
      paddingHorizontal: 16,
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textLight,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingTop: 40,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
  });
