import React, { useEffect, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { ErrorState } from '../ui/ErrorState';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TrailCover } from '../trail/TrailCover';
import { useColors, ColorPalette } from '../../constants/colors';
import { useOutlook } from '../../hooks/useOutlook';
import { useBookmarkList } from '../../hooks/useBookmarks';
import { usePrefetchTrail } from '../../hooks/useTrails';
import { useSettingsStore } from '../../store/settingsStore';
import { haptics } from '../../utils/haptics';
import { localName } from '../../utils/i18n';
import { degrees } from '../../utils/trailVerdict';
import type { GoodDay } from '../../services/outlook';

type Styles = ReturnType<typeof createStyles>;

/** Today and the two days after it. */
const DAYS = 3;
/** Bookmarks come 20 to a page: enough pages for the trails people save. */
const MAX_BOOKMARK_PAGES = 5;
const GEORGIA_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today in Georgia, where the outlook's dates are. */
export function georgianToday(now = Date.now()): string {
  return new Date(now + GEORGIA_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** "Saturday 22 Nov", with "Today · " or "Tomorrow · " in front of those two. */
export function goodDayTitle(date: string, today: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const name = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  if (date === today) return `Today · ${name}`;
  if (date === next.toISOString().slice(0, 10)) return `Tomorrow · ${name}`;
  return name;
}

/** "-2° to 6°", one temperature when both round the same, or null without any. */
export function tempRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) {
    const one = min ?? max;
    return one == null ? null : degrees(one);
  }
  return Math.round(min) === Math.round(max) ? degrees(max) : `${degrees(min)} to ${degrees(max)}`;
}

export interface GoodDaySection {
  day: string;
  title: string;
  data: GoodDay[];
}

/** By day, soonest first; within a day the trails you bookmarked first, the rest as listed. */
export function groupGoodDays(days: GoodDay[], saved: ReadonlySet<string>, today: string): GoodDaySection[] {
  const byDay = new Map<string, GoodDay[]>();
  for (const d of days) byDay.set(d.day, [...(byDay.get(d.day) ?? []), d]);
  return [...byDay.keys()].sort().map((day) => {
    const list = byDay.get(day) ?? [];
    return {
      day,
      title: goodDayTitle(day, today),
      data: [...list.filter((d) => saved.has(d.trail_id)), ...list.filter((d) => !saved.has(d.trail_id))],
    };
  });
}

const GoodDayRow = React.memo(function GoodDayRow({
  item,
  saved,
  name,
  onPressIn,
  styles,
  Colors,
}: {
  item: GoodDay;
  saved: boolean;
  name: string;
  onPressIn: (trailId: string) => void;
  styles: Styles;
  Colors: ColorPalette;
}) {
  const temps = tempRange(item.temp_min_c, item.temp_max_c);
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPressIn={() => onPressIn(item.trail.id)}
      onPress={() => {
        haptics.tap();
        router.push(`/trail/${item.trail.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${name}${saved ? ', bookmarked' : ''}. ${item.label}: ${item.headline}${temps ? `, ${temps}` : ''}`}
      testID={`good-day-${item.trail_id}`}
    >
      <TrailCover uri={item.trail.cover_image_url} style={styles.cover} iconSize={22} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {saved ? <Icon name="heart" size={14} color={Colors.error} testID={`good-day-saved-${item.trail_id}`} /> : null}
        </View>
        {item.trail.region ? (
          <Text style={styles.region} numberOfLines={1}>
            {item.trail.region}
          </Text>
        ) : null}
        <View style={styles.verdictRow}>
          <View style={[styles.pill, { backgroundColor: Colors.success }]}>
            <Text style={styles.pillText}>{item.label}</Text>
          </View>
          {temps ? <Text style={styles.temps}>{temps}</Text> : null}
        </View>
        <Text style={styles.headline} numberOfLines={2}>
          {item.headline}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function EmptyGoodDays({ styles, Colors }: { styles: Styles; Colors: ColorPalette }) {
  return (
    <View style={styles.empty} testID="empty-good-days">
      <Icon name="partly-sunny-outline" size={36} color={Colors.textLight} />
      <Text style={styles.emptyText}>No clearly good days in the next three days. Check back tomorrow.</Text>
    </View>
  );
}

/**
 * The Feed tab's Good days segment: the trails whose forecast says go in the next three days,
 * grouped by day, with the ones you bookmarked first.
 */
export function GoodDaysList() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const language = useSettingsStore((s) => s.language);
  const { data, isLoading, isError, error, refetch, isRefetching } = useOutlook(DAYS);
  const bookmarks = useBookmarkList();
  const prefetchTrail = usePrefetchTrail();

  // Every trail you saved counts, not only the latest page of them
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = bookmarks;
  const bookmarkPages = bookmarks.data?.pages.length ?? 0;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && bookmarkPages < MAX_BOOKMARK_PAGES) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, bookmarkPages, fetchNextPage]);

  const saved = useMemo(
    () =>
      new Set(
        (bookmarks.data?.pages ?? [])
          .flatMap((page) => page.data ?? [])
          .map((b) => b.trails?.id)
          .filter((id): id is string => !!id),
      ),
    [bookmarks.data],
  );
  const sections = useMemo(() => groupGoodDays(data ?? [], saved, georgianToday()), [data, saved]);

  const intro = <Text style={styles.intro}>Trails with a good day ahead, by the forecast at each trail's highest point.</Text>;

  if (isLoading) {
    return (
      <View style={styles.fill} testID="good-days-list">
        {intro}
        <LoadingSpinner />
      </View>
    );
  }

  if (isError && sections.length === 0) {
    return (
      <View style={styles.fill} testID="good-days-list">
        {intro}
        <ErrorState error={error} title="Couldn't load the good days" onRetry={() => refetch()} retrying={isRefetching} />
      </View>
    );
  }

  return (
    <SectionList
      testID="good-days-list"
      sections={sections}
      keyExtractor={(item) => `${item.day}-${item.trail_id}`}
      renderSectionHeader={({ section }) => <Text style={styles.dayTitle}>{section.title}</Text>}
      renderItem={({ item }) => (
        <GoodDayRow
          item={item}
          saved={saved.has(item.trail_id)}
          name={localName(item.trail.name_en, item.trail.name_ka, language)}
          onPressIn={prefetchTrail}
          styles={styles}
          Colors={Colors}
        />
      )}
      ListHeaderComponent={intro}
      ListEmptyComponent={<EmptyGoodDays styles={styles} Colors={Colors} />}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.list, sections.length === 0 && styles.listEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.primary]} tintColor={Colors.primary} />
      }
    />
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    fill: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    list: {
      paddingTop: 4,
      paddingBottom: 24,
    },
    listEmpty: {
      flexGrow: 1,
    },
    intro: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    dayTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.text,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      backgroundColor: Colors.surface,
    },
    cover: {
      width: 64,
      height: 64,
      borderRadius: 10,
      overflow: 'hidden',
    },
    body: {
      flex: 1,
      gap: 3,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    region: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    verdictRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    pill: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    temps: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.text,
    },
    headline: {
      fontSize: 13,
      lineHeight: 17,
      color: Colors.textSecondary,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 32,
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
  });
