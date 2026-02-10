import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useMyCompletions } from '../../../hooks/useCompletions';
import { DifficultyBadge } from '../../../components/trail/DifficultyBadge';
import { TrailDifficulty } from '../../../types/trail';
import {
  formatDate,
  formatDistance,
  formatElevation,
  formatDuration,
} from '../../../utils/formatters';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

function formatElapsedTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function CompletionDetailScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: completions, isLoading } = useMyCompletions();

  const completion = completions?.find((c) => c.id === id);

  if (isLoading) return <LoadingSpinner />;

  if (!completion) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Completion not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const trail = completion.trails;
  const hasActualTime = completion.elapsed_seconds != null;
  const hasEstimate = trail?.estimated_hours != null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        {trail?.cover_image_url ? (
          <Image source={{ uri: trail.cover_image_url }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Ionicons name="trail-sign-outline" size={48} color={Colors.textLight} />
          </View>
        )}

        {/* Back button overlay */}
        <TouchableOpacity
          style={[styles.backIcon, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Trail Name & Info */}
          <Text style={styles.trailName}>{trail?.name_en ?? 'Unknown Trail'}</Text>

          <View style={styles.metaRow}>
            {trail?.difficulty && (
              <DifficultyBadge difficulty={trail.difficulty as TrailDifficulty} size="md" />
            )}
            {trail?.region && (
              <View style={styles.regionBadge}>
                <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.regionText}>{trail.region}</Text>
              </View>
            )}
          </View>

          {/* Completion Date */}
          <View style={styles.dateRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.dateText}>
              Completed on {formatDate(completion.completed_at)}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {hasActualTime && (
              <View style={styles.statCard}>
                <Ionicons name="timer-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>
                  {formatElapsedTime(completion.elapsed_seconds!)}
                </Text>
                <Text style={styles.statLabel}>Your Time</Text>
              </View>
            )}

            {trail?.distance_km != null && (
              <View style={styles.statCard}>
                <Ionicons name="map-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{formatDistance(trail.distance_km)}</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            )}

            {trail?.elevation_gain_m != null && (
              <View style={styles.statCard}>
                <Ionicons name="trending-up-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{formatElevation(trail.elevation_gain_m)}</Text>
                <Text style={styles.statLabel}>Elevation</Text>
              </View>
            )}

            {hasEstimate && (
              <View style={styles.statCard}>
                <Ionicons name="hourglass-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{formatDuration(trail!.estimated_hours!)}</Text>
                <Text style={styles.statLabel}>Estimated</Text>
              </View>
            )}
          </View>

          {/* Time Comparison */}
          {hasActualTime && hasEstimate && (
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>Time Comparison</Text>
              <View style={styles.comparisonRow}>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonValue}>
                    {formatElapsedTime(completion.elapsed_seconds!)}
                  </Text>
                  <Text style={styles.comparisonLabel}>Actual</Text>
                </View>
                <Ionicons name="swap-horizontal" size={24} color={Colors.textLight} />
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonValue}>
                    {formatDuration(trail!.estimated_hours!)}
                  </Text>
                  <Text style={styles.comparisonLabel}>Estimated</Text>
                </View>
              </View>
              {(() => {
                const actualHours = completion.elapsed_seconds! / 3600;
                const diff = ((actualHours - trail!.estimated_hours!) / trail!.estimated_hours!) * 100;
                const isFaster = diff < 0;
                return (
                  <Text
                    style={[
                      styles.comparisonSummary,
                      { color: isFaster ? Colors.success : Colors.accent },
                    ]}
                  >
                    {isFaster
                      ? `${Math.abs(Math.round(diff))}% faster than estimated`
                      : `${Math.round(diff)}% slower than estimated`}
                  </Text>
                );
              })()}
            </View>
          )}

          {/* View Trail Button */}
          <TouchableOpacity
            style={styles.viewTrailButton}
            onPress={() => router.push(`/trail/${completion.trail_id}`)}
          >
            <Ionicons name="trail-sign-outline" size={20} color={Colors.primary} />
            <Text style={styles.viewTrailText}>View Trail Details</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  coverImage: {
    width: '100%',
    height: 220,
  },
  coverPlaceholder: {
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface + 'E0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  content: {
    padding: 20,
  },
  trailName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  regionText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  comparisonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  comparisonItem: {
    alignItems: 'center',
    gap: 4,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  comparisonLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  comparisonSummary: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  viewTrailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary + '15',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 32,
  },
  viewTrailText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});
