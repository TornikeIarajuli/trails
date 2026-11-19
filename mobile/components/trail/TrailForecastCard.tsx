import React from 'react';
import { ForecastCard } from '../weather/ForecastCard';
import { useTrailForecast } from '../../hooks/useTrailForecast';
import { useWeather } from '../../hooks/useWeather';
import { getWeatherInfo } from '../../services/weather';
import { parseGeoPoint } from '../../utils/geo';
import { degrees, neededHours } from '../../utils/trailVerdict';
import type { Activity } from '../../utils/activities';
import type { TrailDetail } from '../../types/trail';

/** Climbing is offered where a trail reaches the high mountains. */
const ALPINE_FROM_M = 3000;

interface TrailForecastCardProps {
  trail: TrailDetail;
  /** False while the screen shows the list's placeholder (no route or profile yet). */
  ready: boolean;
}

/**
 * Trail screen: go, wait or skip for today and the next six days, from the forecast at the
 * trail's highest point, with the reason, the best window, sunrise and sunset; and the same
 * for camping, running, photos and stars on the trail.
 */
export function TrailForecastCard({ trail, ready }: TrailForecastCardProps) {
  const { data: forecast, point } = useTrailForecast(trail, ready);
  const start = parseGeoPoint(trail.start_point);
  const { data: atStart } = useWeather(start?.latitude ?? null, start?.longitude ?? null);
  if (!forecast || !point) return null;

  const topM = point.atTop ? point.elevationM : null;
  const where = point.atTop && point.elevationM != null ? `at ${point.elevationM.toLocaleString('en-US')} m` : 'at the start';
  const current = forecast.current;
  const nowLine =
    current?.tempC != null
      ? `Now ${point.atTop ? 'at the top' : 'at the start'}: ${degrees(current.tempC)}` +
        (current.feelsC != null ? ` (feels ${degrees(current.feelsC)})` : '') +
        (point.atTop && atStart && start
          ? ` · at the start: ${degrees(atStart.temperature)}, ${getWeatherInfo(atStart.weathercode).label.toLowerCase()}`
          : '')
      : null;
  const activities: Activity[] = ['hiking', 'camping', 'running', 'photography', 'stargazing'];
  if (topM != null && topM >= ALPINE_FROM_M) activities.push('alpinism');

  return (
    <ForecastCard
      forecast={forecast}
      latitude={point.latitude}
      longitude={point.longitude}
      where={where}
      neededHours={neededHours(trail)}
      topM={topM}
      activities={activities}
      nowLine={nowLine}
      sourcePlace={point.atTop ? 'the highest point' : 'the start'}
      tempLabel={point.atTop ? 'At the top' : 'Temperature'}
      fords={trail.terrain?.fords}
      testID="trail-forecast"
    />
  );
}
