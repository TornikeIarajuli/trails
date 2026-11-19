import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Icon, IconName } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useTrailForecast } from '../../hooks/useTrailForecast';
import { useWeather } from '../../hooks/useWeather';
import { getWeatherInfo } from '../../services/weather';
import { parseGeoPoint } from '../../utils/geo';
import {
  DayVerdict,
  Verdict,
  dayName,
  defaultDayIndex,
  degrees,
  finishAfterDark,
  formatDaylight,
  judgeForecast,
  localNow,
  neededHours,
} from '../../utils/trailVerdict';
import type { TrailDetail } from '../../types/trail';

/** A saved forecast older than this says when it is from. */
const STALE_AFTER_MS = 60 * 60 * 1000;

function verdictColor(verdict: Verdict, Colors: ColorPalette): string {
  return verdict === 'go' ? Colors.success : verdict === 'wait' ? Colors.warning : Colors.error;
}

/** "08:15" in the phone's clock, for "Updated 08:15". */
function clockOf(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface TrailForecastCardProps {
  trail: TrailDetail;
  /** False while the screen shows the list's placeholder (no route or profile yet). */
  ready: boolean;
}

/**
 * Trail screen: go, wait or skip for today and the next six days, from the forecast at the
 * trail's highest point, with the reason, the best window, sunrise and sunset.
 */
export function TrailForecastCard({ trail, ready }: TrailForecastCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: forecast, point } = useTrailForecast(trail, ready);
  const start = parseGeoPoint(trail.start_point);
  const { data: atStart } = useWeather(start?.latitude ?? null, start?.longitude ?? null);
  const hours = neededHours(trail);
  const topM = point?.atTop ? point.elevationM : null;

  const verdicts = useMemo(
    () => (forecast ? judgeForecast(forecast, { neededHours: hours, topM }) : []),
    [forecast, hours, topM],
  );
  const [selected, setSelected] = useState<number | null>(null);
  // A new forecast (or a new day) starts on today, or on tomorrow after 2 pm
  useEffect(() => setSelected(null), [forecast?.fetchedAt]);

  if (!forecast || verdicts.length === 0) return null;

  const index = Math.min(selected ?? defaultDayIndex(verdicts, forecast.utcOffsetSeconds), verdicts.length - 1);
  const day = verdicts[index];
  const isToday = day.date === localNow(forecast.utcOffsetSeconds).date;
  const color = verdictColor(day.verdict, Colors);
  const afterDark = isToday ? finishAfterDark(day, hours, forecast.utcOffsetSeconds) : null;
  const where = point?.atTop && point.elevationM != null ? `at ${point.elevationM.toLocaleString('en-US')} m` : 'at the start';
  // A forecast kept from earlier (offline) says when it is from, and has no "now"
  const stale = Date.now() - forecast.fetchedAt > STALE_AFTER_MS;

  return (
    <View style={styles.card} testID="trail-forecast">
      <View style={styles.header}>
        <Icon name="partly-sunny-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.headerText}>Hiking weather</Text>
        <Text style={styles.where}>{where}</Text>
      </View>

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

      {day.window && day.verdict !== 'skip' ? (
        <Text style={styles.windowText}>
          Best window {day.window.start}–{day.window.end}
        </Text>
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
            label={point?.atTop ? 'At the top' : 'Temperature'}
            styles={styles}
            Colors={Colors}
          />
        ) : null}
        {day.gustMaxKmh != null ? (
          <Fact icon="wind" text={`${Math.round(day.gustMaxKmh)} km/h`} label="Gusts" styles={styles} Colors={Colors} />
        ) : null}
        {day.uvMax != null ? <Fact icon="sunny-outline" text={`UV ${Math.round(day.uvMax)}`} label={uvLabel(day.uvMax)} styles={styles} Colors={Colors} /> : null}
      </View>

      {isToday && !stale && forecast.current?.tempC != null ? (
        <Text style={styles.now}>
          Now at the top: {degrees(forecast.current.tempC)}
          {forecast.current.feelsC != null ? ` (feels ${degrees(forecast.current.feelsC)})` : ''}
          {atStart && start ? ` · at the start: ${degrees(atStart.temperature)}, ${getWeatherInfo(atStart.weathercode).label.toLowerCase()}` : ''}
        </Text>
      ) : null}

      <Text style={styles.source}>
        Open-Meteo forecast for {point?.atTop ? 'the highest point' : 'the start'}
        {stale ? `, updated ${clockOf(forecast.fetchedAt)}` : ''}. Mountain weather changes fast: check again before you go.
      </Text>
    </View>
  );
}

function uvLabel(uv: number): string {
  if (uv >= 8) return 'Very high';
  if (uv >= 6) return 'High';
  if (uv >= 3) return 'Moderate';
  return 'Low';
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

function Fact({
  icon,
  text,
  label,
  styles,
  Colors,
}: {
  icon: IconName;
  text: string;
  label: string;
  styles: Styles;
  Colors: ColorPalette;
}) {
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
