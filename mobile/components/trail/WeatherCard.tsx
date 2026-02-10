import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useWeather } from '../../hooks/useWeather';
import { getWeatherInfo } from '../../services/weather';

interface WeatherCardProps {
  latitude: number | null;
  longitude: number | null;
}

export function WeatherCard({ latitude, longitude }: WeatherCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: weather, isLoading } = useWeather(latitude, longitude);

  if (!latitude || !longitude || isLoading || !weather) return null;

  const info = getWeatherInfo(weather.weathercode);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="cloud-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.headerText}>Trail Weather</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.mainWeather}>
          <Ionicons name={info.icon as any} size={32} color={Colors.primary} />
          <Text style={styles.temperature}>{Math.round(weather.temperature)}°C</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.condition}>{info.label}</Text>
          <View style={styles.windRow}>
            <Ionicons name="speedometer-outline" size={14} color={Colors.textLight} />
            <Text style={styles.windText}>{Math.round(weather.windspeed)} km/h wind</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
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
    marginBottom: 12,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mainWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  temperature: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  details: {
    flex: 1,
    gap: 4,
  },
  condition: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  windRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  windText: {
    fontSize: 13,
    color: Colors.textLight,
  },
});
