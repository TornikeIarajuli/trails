import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { File as FSFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useMyCompletions } from '../../../hooks/useCompletions';
import { useHikeStore } from '../../../store/hikeStore';
import { DifficultyBadge } from '../../../components/trail/DifficultyBadge';
import { TrailDifficulty } from '../../../types/trail';
import {
  formatDate,
  formatDistance,
  formatElevation,
  formatDuration,
} from '../../../utils/formatters';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { buildGpxString } from '../../../utils/gpxExport';
import { Confetti } from '../../../components/ui/Confetti';
import { BadgeUnlockModal } from '../../../components/badges/BadgeUnlockModal';
import { useAllBadges } from '../../../hooks/useBadges';
import { Badge } from '../../../types/badge';
import { analytics } from '../../../utils/analytics';

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

  const { id, newBadgeIds: rawBadgeIds } = useLocalSearchParams<{ id: string; newBadgeIds?: string }>();
  const insets = useSafeAreaInsets();
  const { data: completions, isLoading } = useMyCompletions();
  const lastHikeGpsPoints = useHikeStore((s) => s.lastHikeGpsPoints);
  const clearLastHikeGps = useHikeStore((s) => s.clearLastHikeGps);
  const { data: allBadges } = useAllBadges();

  const [showConfetti, setShowConfetti] = useState(true);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);

  // Parse new badge IDs from URL and match to badge objects
  useEffect(() => {
    if (!rawBadgeIds || !allBadges) return;
    try {
      const ids: string[] = JSON.parse(decodeURIComponent(rawBadgeIds));
      const matched = ids.map((bid) => allBadges.find((b) => b.id === bid)).filter(Boolean) as Badge[];
      if (matched.length > 0) {
        setNewBadges(matched);
        matched.forEach((b) => analytics.badgeEarned(b.key, b.name_en));
        // Show badge modal after confetti plays (1.5s delay)
        const t = setTimeout(() => setShowBadgeModal(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore malformed param
    }
  }, [rawBadgeIds, allBadges]);

  // Auto-hide confetti after 3.5s
  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(t);
  }, []);

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

  const handleShare = async () => {
    const lines: string[] = [`🏔️ I completed ${trail?.name_en ?? 'a trail'}!`];
    if (hasActualTime) lines.push(`⏱️ Time: ${formatElapsedTime(completion.elapsed_seconds!)}`);
    if (trail?.distance_km != null) lines.push(`📏 Distance: ${formatDistance(trail.distance_km)}`);
    if (trail?.elevation_gain_m != null) lines.push(`⬆️ Elevation: ${formatElevation(trail.elevation_gain_m)}`);
    if (hasActualTime && hasEstimate) {
      const actualHours = completion.elapsed_seconds! / 3600;
      const diff = ((actualHours - trail!.estimated_hours!) / trail!.estimated_hours!) * 100;
      if (diff < 0) lines.push(`🔥 ${Math.abs(Math.round(diff))}% faster than estimated!`);
    }
    lines.push('#GeorgiaTrails');
    await Share.share({ message: lines.join('\n') });
  };

  const handleExportGpx = async () => {
    if (lastHikeGpsPoints.length === 0) {
      Alert.alert('No GPS data', 'No GPS track is available for this hike.');
      return;
    }
    try {
      const trailName = trail?.name_en ?? 'hike';
      const filename = `${trailName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`;
      const gpx = buildGpxString(trailName, lastHikeGpsPoints);
      const f = new FSFile(Paths.cache, filename);
      f.write(gpx);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(f.uri, { mimeType: 'application/gpx+xml', dialogTitle: 'Export GPX Track' });
        clearLastHikeGps();
      } else {
        Alert.alert('Sharing not available', 'Your device does not support file sharing.');
      }
    } catch {
      Alert.alert('Export failed', 'Could not export the GPX file. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Confetti visible={showConfetti} />
      <BadgeUnlockModal
        badges={newBadges}
        visible={showBadgeModal}
        onClose={() => setShowBadgeModal(false)}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        {trail?.cover_image_url ? (
          <Image source={{ uri: trail.cover_image_url }} style={styles.coverImage} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Ionicons name="trail-sign-outline" size={48} color={Colors.textLight} />
          </View>
        )}

        {/* Back button overlay */}
        <TouchableOpacity
          style={[styles.backIcon, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {/* Share button overlay */}
        <TouchableOpacity
          style={[styles.shareIcon, { top: insets.top + 8 }]}
          onPress={handleShare}
          accessibilityLabel="Share completion"
          accessibilityRole="button"
        >
          <Ionicons name="share-outline" size={22} color={Colors.text} />
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

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.replace('/(tabs)/profile' as any)}
          >
            <Ionicons name="person-outline" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.profileButtonText}>Go to Profile</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.viewTrailButton}
              onPress={() => router.push(`/trail/${completion.trail_id}`)}
            >
              <Ionicons name="trail-sign-outline" size={20} color={Colors.primary} />
              <Text style={styles.viewTrailText}>View Trail</Text>
            </TouchableOpacity>

            {lastHikeGpsPoints.length > 0 && (
              <TouchableOpacity style={styles.gpxButton} onPress={handleExportGpx}>
                <Ionicons name="download-outline" size={20} color={Colors.accent} />
                <Text style={styles.gpxButtonText}>Export GPX</Text>
              </TouchableOpacity>
            )}
          </View>
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
  shareIcon: {
    position: 'absolute',
    right: 16,
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
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  profileButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  viewTrailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary + '15',
    paddingVertical: 14,
    borderRadius: 12,
  },
  viewTrailText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  gpxButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent + '15',
    paddingVertical: 14,
    borderRadius: 12,
  },
  gpxButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.accent,
  },
});
