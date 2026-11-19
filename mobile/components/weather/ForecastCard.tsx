import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Icon, IconName } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { getWeatherInfo } from '../../services/weather';
import type { MountainForecast } from '../../services/forecast';
import {
  DayVerdict,
  Verdict,
  dayName,
  defaultDayIndex,
  degrees,
  finishAfterDark,
  formatDaylight,
  localNow,
} from '../../utils/trailVerdict';
import { ACTIVITIES, Activity, judgeActivity } from '../../utils/activities';
import { SKY_LABEL, hourlyCells, nightSky } from '../../utils/sky';

/** A saved forecast older than this says when it is from. */
const STALE_AFTER_MS = 60 * 60 * 1000;

export function verdictColor(verdict: Verdict, Colors: ColorPalette): string {
  return verdict === 'go' ? Colors.success : verdict === 'wait' ? Colors.warning : Colors.error;
}

/** "08:15" in the phone's clock, for "Updated 08:15". */
function clockOf(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function uvLabel(uv: number): string {
  if (uv >= 8) return 'Very high';
  if (uv >= 6) return 'High';
  if (uv >= 3) return 'Moderate';
  return 'Low';
}

export interface ForecastCardProps {
  forecast: MountainForecast | undefined;
  /** Where the forecast is for. */
  latitude: number;
  longitude: number;
  /** "at 2,400 m", "at the start", "here". */
  where: string;
  /** "Hiking weather", "Conditions", "Weather here". */
  title?: string;
  /** Hours of walking for the hiking verdict. */
  neededHours?: number;
  /** The highest point, for the freezing level; null when unknown. */
  topM?: number | null;
  /** The activities offered (all by default) and the one shown first. */
  activities?: Activity[];
  defaultActivity?: Activity;
  /** Today only, under the facts: "Now at the top: 4° …". */
  nowLine?: string | null;
  /** "the highest point", "this place", "where you are". */
  sourcePlace?: string;
  /** River crossings without a bridge (4×4). */
  fords?: number;
  /** Label for the temperatures: "At the top" or "Temperature". */
  tempLabel?: string;
  testID?: string;
}

/**
 * Go, wait or skip for today and the next six days, for the activity picked: the reason, the
 * best window or the activity's own highlights (golden hour, bite windows, the dark hours),
 * the day hour by hour, sun and moon, and tonight's sky. Used for trails, places and where you
 * stand.
 */
export function ForecastCard({
  forecast,
  latitude,
  longitude,
  where,
  title = 'Hiking weather',
  neededHours = 4,
  topM = null,
  activities = ACTIVITIES.map((a) => a.key),
  defaultActivity = 'hiking',
  nowLine = null,
  sourcePlace = 'the highest point',
  fords,
  tempLabel = 'At the top',
  testID = 'forecast-card',
}: ForecastCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [activity, setActivity] = useState<Activity>(defaultActivity);
  const [selected, setSelected] = useState<number | null>(null);
  // A new forecast (or a new day) starts on today, or on tomorrow after 2 pm
  useEffect(() => setSelected(null), [forecast?.fetchedAt]);
  useEffect(() => setActivity(defaultActivity), [defaultActivity]);

  const verdicts = useMemo(
    () => (forecast ? judgeActivity(activity, forecast, { neededHours, topM, latitude, longitude, fords }) : []),
    [forecast, activity, neededHours, topM, latitude, longitude, fords],
  );

  if (!forecast || verdicts.length === 0) return null;

  const offset = forecast.utcOffsetSeconds;
  const index = Math.min(selected ?? defaultDayIndex(verdicts, offset), verdicts.length - 1);
  const day = verdicts[index];
  const isToday = day.date === localNow(offset).date;
  const color = verdictColor(day.verdict, Colors);
  const afterDark = isToday && activity === 'hiking' ? finishAfterDark(day, neededHours, offset) : null;
  // A forecast kept from earlier (offline) says when it is from, and has no "now"
  const stale = Date.now() - forecast.fetchedAt > STALE_AFTER_MS;
  const cells = hourlyCells(forecast.hours, day.date, isToday, offset);
  const sky = nightSky(day.date, forecast.hours, latitude, longitude, offset);
  const offered = ACTIVITIES.filter((a) => activities.includes(a.key));

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Icon name="partly-sunny-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.headerText}>{title}</Text>
        <Text style={styles.where}>{where}</Text>
      </View>

      {offered.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activities}>
          {offered.map((a) => {
            const active = a.key === activity;
            return (
              <TouchableOpacity
                key={a.key}
                style={[styles.activity, active && styles.activityActive]}
                onPress={() => setActivity(a.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`activity-${a.key}`}
              >
                <Icon name={a.icon as IconName} size={14} color={active ? Colors.textOnPrimary : Colors.textSecondary} />
                <Text style={[styles.activityText, active && styles.activityTextActive]}>{a.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {verdicts.map((v, i) => (
          <DayChip key={v.date} verdict={v} index={i} selected={i === index} onPress={() => setSelected(i)} styles={styles} Colors={Colors} />
        ))}
      </ScrollView>

      <View style={styles.verdictRow} accessible accessibilityLabel={`${dayName(day.date, index)}: ${day.label}. ${day.headline}.`}>
        <View style={[styles.verdictPill, { backgroundColor: color }]}>
          <Text style={styles.verdictText}>{day.label}</Text>
        </View>
        <Text style={styles.headline}>{day.headline}</Text>
      </View>

      {day.window && day.verdict !== 'skip' && activity === 'hiking' ? (
        <Text style={styles.windowText}>
          Best window {day.window.start}–{day.window.end}
        </Text>
      ) : null}

      {day.highlights && day.highlights.length > 0 ? (
        <View style={styles.highlights} testID="forecast-highlights">
          {day.highlights.map((h) => (
            <View key={`${h.label}-${h.value}`} style={styles.highlight}>
              <Text style={styles.highlightLabel}>{h.label}</Text>
              <Text style={styles.highlightValue}>{h.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {afterDark ? (
        <View style={styles.warnRow}>
          <Icon name="moon-outline" size={14} color={Colors.warning} />
          <Text style={styles.warnText}>Starting now, you would finish after sunset ({afterDark}).</Text>
        </View>
      ) : null}

      {day.notes.length > 0 ? (
        <View style={styles.notes}>
          {day.notes.map((note) => (
            <Text key={note} style={styles.note}>
              · {note}
            </Text>
          ))}
        </View>
      ) : null}

      {cells.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hours} testID="forecast-hours">
          {cells.map((c) => {
            const info = c.weathercode != null ? getWeatherInfo(c.weathercode) : null;
            return (
              <View key={c.time} style={styles.hourCell} accessible accessibilityLabel={`${c.hour}:00, ${c.tempC != null ? degrees(c.tempC) : ''} ${info?.label ?? ''}`}>
                <Text style={styles.hourText}>{c.hour}</Text>
                {info ? <Icon name={info.icon as IconName} size={18} color={Colors.textSecondary} /> : null}
                <Text style={styles.hourTemp}>{c.tempC != null ? degrees(c.tempC) : '–'}</Text>
                <Text style={styles.hourRain}>
                  {c.precipProbability != null && c.precipProbability >= 20 ? `${Math.round(c.precipProbability)}%` : ' '}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.facts}>
        {day.sunrise ? <Fact icon="sunrise" text={day.sunrise} label="Sunrise" styles={styles} Colors={Colors} /> : null}
        {day.sunset ? <Fact icon="sunset" text={day.sunset} label="Sunset" styles={styles} Colors={Colors} /> : null}
        {day.daylightSeconds != null ? (
          <Fact icon="time-outline" text={formatDaylight(day.daylightSeconds)} label="Daylight" styles={styles} Colors={Colors} />
        ) : null}
        {day.tempMinC != null && day.tempMaxC != null ? (
          <Fact
            icon="thermometer"
            text={
              degrees(day.tempMinC) === degrees(day.tempMaxC)
                ? degrees(day.tempMaxC)
                : `${degrees(day.tempMinC)} to ${degrees(day.tempMaxC)}`
            }
            label={tempLabel}
            styles={styles}
            Colors={Colors}
          />
        ) : null}
        {day.gustMaxKmh != null ? (
          <Fact icon="wind" text={`${Math.round(day.gustMaxKmh)} km/h`} label="Gusts" styles={styles} Colors={Colors} />
        ) : null}
        {day.uvMax != null ? (
          <Fact icon="sunny-outline" text={`UV ${Math.round(day.uvMax)}`} label={uvLabel(day.uvMax)} styles={styles} Colors={Colors} />
        ) : null}
      </View>

      {sky ? (
        <View style={styles.skyRow} testID="forecast-sky" accessible>
          <Icon name="moon-outline" size={16} color={Colors.primary} />
          <Text style={styles.skyText}>
            {sky.moonPhase} ({sky.moonPercent}%) · {SKY_LABEL[sky.rating]}
            {sky.darkFrom && sky.darkUntil ? `, dark ${sky.darkFrom}–${sky.darkUntil}` : ''}
          </Text>
        </View>
      ) : null}

      {isToday && !stale && nowLine ? <Text style={styles.now}>{nowLine}</Text> : null}

      <Text style={styles.source}>
        Open-Meteo forecast for {sourcePlace}
        {stale ? `, updated ${clockOf(forecast.fetchedAt)}` : ''}. Mountain weather changes fast: check again before you go.
      </Text>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function DayChip({
  verdict,
  index,
  selected,
  onPress,
  styles,
  Colors,
}: {
  verdict: DayVerdict;
  index: number;
  selected: boolean;
  onPress: () => void;
  styles: Styles;
  Colors: ColorPalette;
}) {
  const info = verdict.weathercode != null ? getWeatherInfo(verdict.weathercode) : null;
  const color = verdictColor(verdict.verdict, Colors);
  const name = dayName(verdict.date, index);
  return (
    <TouchableOpacity
      style={[styles.chip, selected && { borderColor: color, backgroundColor: color + '14' }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}: ${verdict.label}`}
      testID={`forecast-day-${index}`}
    >
      <Text style={[styles.chipDay, selected && { color: Colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      {info ? <Icon name={info.icon as IconName} size={20} color={Colors.textSecondary} /> : null}
      <View style={[styles.chipVerdict, { backgroundColor: color }]}>
        <Text style={styles.chipVerdictText}>{verdict.verdict === 'go' ? 'Go' : verdict.verdict === 'wait' ? 'Wait' : 'Skip'}</Text>
      </View>
      {verdict.tempMaxC != null ? <Text style={styles.chipTemp}>{degrees(verdict.tempMaxC)}</Text> : null}
    </TouchableOpacity>
  );
}

function Fact({ icon, text, label, styles, Colors }: { icon: IconName; text: string; label: string; styles: Styles; Colors: ColorPalette }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${text}`}>
      <Icon name={icon} size={16} color={Colors.primary} />
      <View>
        <Text style={styles.factText}>{text}</Text>
        <Text style={styles.factLabel}>{label}</Text>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 16,
      gap: 12,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    where: {
      fontSize: 12,
      color: Colors.textLight,
    },
    activities: {
      gap: 6,
    },
    activity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    activityActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    activityText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    activityTextActive: {
      color: Colors.textOnPrimary,
    },
    days: {
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      width: 64,
      alignItems: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.borderLight,
    },
    chipDay: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    chipVerdict: {
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },
    chipVerdictText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    chipTemp: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.text,
    },
    verdictRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    verdictPill: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    verdictText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    headline: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    windowText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    highlights: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    highlight: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: Colors.primary + '12',
    },
    highlightLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
    },
    highlightValue: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.text,
    },
    warnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    warnText: {
      flex: 1,
      fontSize: 13,
      color: Colors.text,
    },
    notes: {
      gap: 3,
    },
    note: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
    },
    hours: {
      gap: 4,
    },
    hourCell: {
      width: 44,
      alignItems: 'center',
      gap: 3,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: Colors.background,
    },
    hourText: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    hourTemp: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.text,
    },
    hourRain: {
      fontSize: 10,
      color: Colors.primary,
    },
    facts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 10,
    },
    fact: {
      width: '33%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    factText: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.text,
      fontVariant: ['tabular-nums'],
    },
    factLabel: {
      fontSize: 11,
      color: Colors.textLight,
    },
    skyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    skyText: {
      flex: 1,
      fontSize: 13,
      color: Colors.text,
    },
    now: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    source: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textLight,
    },
  });
