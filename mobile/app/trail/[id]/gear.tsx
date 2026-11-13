import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrail } from '../../../hooks/useTrails';
import { useProducts } from '../../../hooks/useShop';
import { useGearPlan } from '../../../hooks/useGear';
import { useGearStore, localDay } from '../../../store/gearStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { GearProductsSheet } from '../../../components/trail/GearProductsSheet';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Button } from '../../../components/ui/Button';
import { describeForecast, formatElevation, productsForGear, GearItem, GearLevel } from '../../../utils/gear';
import { formatDistance, formatDuration } from '../../../utils/formatters';
import { trailCache } from '../../../utils/trailCache';
import { localName } from '../../../utils/i18n';
import { haptics } from '../../../utils/haptics';
import type { GearKey } from '../../../utils/gearCatalog';

const SECTIONS: { level: GearLevel; title: string }[] = [
  { level: 'essential', title: 'Essential' },
  { level: 'recommended', title: 'Recommended' },
  { level: 'optional', title: 'Nice to have' },
];

const NO_TICKS: string[] = [];

export default function TrailGearScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const startMode = start === '1';
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);

  const { data: trail, isLoading, error, refetch, isRefetching } = useTrail(id);
  const gear = useGearPlan(trail);
  const { data: products } = useProducts();
  const checked = useGearStore((s) => s.ticks[id]?.checked) ?? NO_TICKS;
  const toggle = useGearStore((s) => s.toggle);
  const setChecked = useGearStore((s) => s.setChecked);
  const clear = useGearStore((s) => s.clear);
  const markPrehikeShown = useGearStore((s) => s.markPrehikeShown);
  const [savedOffline, setSavedOffline] = useState(() => trailCache.isTrailSavedOffline(id));
  const [sheetItem, setSheetItem] = useState<GearItem | null>(null);

  // Seen once today before a hike: pressing Start Hike again goes straight to the hike.
  useEffect(() => {
    if (startMode) markPrehikeShown(id, localDay());
  }, [startMode, id, markPrehikeShown]);

  if (!trail || !gear) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <ErrorState error={error} title="Couldn't load this trail" onRetry={() => refetch()} retrying={isRefetching} showBack />
        )}
      </View>
    );
  }

  const { plan, forecast } = gear;
  const checkedSet = new Set(checked);
  const isChecked = (key: GearKey) => checkedSet.has(key) || (key === 'offline_map' && savedOffline);
  const packed = plan.items.filter((i) => isChecked(i.key)).length;
  const notes = trail.gear_notes?.trim();
  const forecastLine = forecast ? describeForecast(forecast) : null;

  const onToggle = (item: GearItem) => {
    haptics.tap();
    if (item.key === 'offline_map') {
      if (savedOffline) return;
      trailCache.saveTrailOffline(id, trail);
      setSavedOffline(true);
      setChecked(id, 'offline_map', true);
      return;
    }
    toggle(id, item.key);
  };

  const confirmClear = () => {
    Alert.alert('Clear the list?', 'Untick everything on this list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clear(id) },
    ]);
  };

  const startHike = () => {
    haptics.tap();
    router.replace(`/trail/${id}/hike`);
  };

  const stats = [
    formatDistance(trail.distance_km),
    formatDuration(plan.hours),
    trail.elevation_gain_m != null ? `↑ ${formatElevation(trail.elevation_gain_m)}` : null,
    plan.maxElevationM != null ? `top ${formatElevation(plan.maxElevationM)}` : null,
  ].filter((s) => s && s !== '--');

  const sheetProducts = sheetItem ? productsForGear(products, sheetItem.key) : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button" testID="back-button">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>{startMode ? 'Before you go' : 'What to bring'}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {localName(trail.name_en, trail.name_ka, language)}
          </Text>
        </View>
        {checked.length > 0 ? (
          <TouchableOpacity onPress={confirmClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear the list">
            <Text style={styles.clear}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (startMode ? 110 : 32) }]}>
        <View style={styles.summary}>
          <Text style={styles.stats}>{stats.join('  ·  ')}</Text>
          {forecastLine ? <Text style={styles.summaryLine}>{forecastLine}</Text> : null}
          {plan.summitHighC != null && plan.maxElevationM != null && forecast?.elevationM != null &&
          plan.maxElevationM - forecast.elevationM >= 300 ? (
            <Text style={styles.summaryLine}>
              About {plan.summitLowC}–{plan.summitHighC}°C at the top ({formatElevation(plan.maxElevationM)})
            </Text>
          ) : null}
          <Text style={styles.packed}>
            {packed} of {plan.items.length} packed
          </Text>
        </View>

        {plan.warnings.map((w) => (
          <View key={w} style={styles.warning}>
            <Ionicons name="warning-outline" size={16} color={Colors.warning} />
            <Text style={styles.warningText}>{w}</Text>
          </View>
        ))}

        {notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>From the team</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {SECTIONS.map(({ level, title }) => {
          const items = plan.items.filter((i) => i.level === level);
          if (items.length === 0) return null;
          return (
            <View key={level} style={styles.section}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <View style={styles.card}>
                {items.map((item, index) => {
                  const done = isChecked(item.key);
                  const matches = productsForGear(products, item.key).length;
                  const note = item.key === 'offline_map' && savedOffline ? 'Saved on this phone' : item.note;
                  return (
                    <View key={item.key} style={[styles.row, index > 0 && styles.rowDivider]}>
                      <TouchableOpacity
                        style={styles.rowMain}
                        onPress={() => onToggle(item)}
                        activeOpacity={0.6}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done }}
                        accessibilityLabel={note ? `${item.label}. ${note}` : item.label}
                      >
                        <Ionicons name={done ? 'checkbox' : 'square-outline'} size={22} color={done ? Colors.success : Colors.textLight} />
                        <Ionicons name={item.icon as never} size={18} color={Colors.textSecondary} />
                        <View style={styles.rowText}>
                          <Text style={[styles.label, done && styles.labelDone]}>{item.label}</Text>
                          {note ? <Text style={styles.note}>{note}</Text> : null}
                        </View>
                      </TouchableOpacity>
                      {matches > 0 ? (
                        <TouchableOpacity
                          style={styles.shopPill}
                          onPress={() => setSheetItem(item)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.label}: ${matches} in the shop`}
                        >
                          <Ionicons name="storefront-outline" size={13} color={Colors.primary} />
                          <Text style={styles.shopText}>{matches}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        <Text style={styles.footnote}>
          A suggestion from the trail's length, height, season and forecast
          {trail.terrain ? ', and terrain from OpenStreetMap' : ''}. Check the conditions before you go.
        </Text>
      </ScrollView>

      {startMode ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
          <Button title="Start Hike" onPress={startHike} />
        </View>
      ) : null}

      <GearProductsSheet
        title={sheetItem ? sheetItem.label : null}
        products={sheetProducts}
        onClose={() => setSheetItem(null)}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitles: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    clear: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    content: {
      paddingHorizontal: 16,
      gap: 14,
    },
    summary: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      gap: 6,
    },
    stats: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    summaryLine: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    packed: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.primary,
      marginTop: 2,
    },
    warning: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: Colors.warning + '14',
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: Colors.text,
    },
    notes: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      gap: 6,
      borderLeftWidth: 4,
      borderLeftColor: Colors.warning,
    },
    notesTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    notesText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.text,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 12,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingLeft: 12,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    labelDone: {
      color: Colors.textSecondary,
    },
    note: {
      fontSize: 12,
      lineHeight: 16,
      color: Colors.textSecondary,
    },
    shopPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    shopText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.primary,
    },
    footnote: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textLight,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: Colors.surface,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
  });
