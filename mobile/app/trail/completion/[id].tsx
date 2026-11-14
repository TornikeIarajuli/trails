import React, { useMemo, useState, useEffect, useRef } from 'react';
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
import { Icon } from '../../../components/ui/Icon';
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
import { describeCompletionOutcome, describeReason } from '../../../utils/verification';
import { VerificationReason } from '../../../types/completion';
import { completionDateLabel, isPastHike, pastHikeYear } from '../../../utils/pastHikes';
import { HowWasTheTrail } from '../../../components/completion/HowWasTheTrail';
import { ShareHikeSheet } from '../../../components/completion/ShareHikeSheet';
import { useTrail } from '../../../hooks/useTrails';
import { parseGeoLineString } from '../../../utils/geo';
import { isPlausibleHikeTime } from '../../../utils/feedPost';
import { cardDate, cardStats } from '../../../utils/shareCard';

function formatElapsedTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function CompletionDetailScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  // `fresh` and the fields after it are only set when arriving straight from a finished hike
  const {
    id,
    newBadgeIds: rawBadgeIds,
    fresh,
    verified: verifiedParam,
    reason: reasonParam,
    coverage: coverageParam,
    required: requiredParam,
    already,
    review,
  } = useLocalSearchParams<{
    id: string;
    newBadgeIds?: string;
    fresh?: string;
    verified?: string;
    reason?: string;
    coverage?: string;
    required?: string;
    already?: string;
    /** The hike did not verify on a trail marked done by a past hike: saved for review, mark kept. */
    review?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { data: completions, isFetching, dataUpdatedAt, errorUpdatedAt, refetch } = useMyCompletions();
  const lastHike = useHikeStore((s) => s.lastHike);
  const { data: allBadges } = useAllBadges();

  const justFinished = fresh === '1';
  const savedForReview = justFinished && review === '1';

  const [showConfetti, setShowConfetti] = useState(justFinished && !savedForReview && verifiedParam !== '0');
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
  // The trail's own route, drawn on the share picture when this hike has no track on the phone
  const { data: trailDetail } = useTrail(completion?.trail_id ?? '');
  const [shareOpen, setShareOpen] = useState(false);

  // The cached list can predate this completion (recorded a moment ago, or on another
  // device), so it only counts as missing after a fetch made while this screen is open.
  const openedAt = useRef(Date.now()).current;
  const checkedSinceOpen = dataUpdatedAt >= openedAt || errorUpdatedAt >= openedAt;
  const loadFailed = !completion && errorUpdatedAt >= openedAt && errorUpdatedAt >= dataUpdatedAt;

  useEffect(() => {
    if (!completion && !checkedSinceOpen && !isFetching) refetch();
  }, [completion, checkedSinceOpen, isFetching, refetch]);

  if (!completion && (!checkedSinceOpen || isFetching)) return <LoadingSpinner />;

  if (!completion) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>
          {loadFailed
            ? 'Could not load this completion. Check your connection and try again.'
            : 'Completion not found'}
        </Text>
        {loadFailed && (
          <TouchableOpacity style={[styles.backButton, styles.retryButton]} onPress={() => refetch()}>
            <Text style={styles.backButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const trail = completion.trails;
  // Marked as done for a year before the app: no date, time, verification or track of its own
  const past = isPastHike(completion);
  const hasActualTime = !past && completion.elapsed_seconds != null;
  const estimatedHours = trail?.estimated_hours ?? null;
  const hasEstimate = estimatedHours != null && estimatedHours > 0;

  const outcome = describeCompletionOutcome({
    status: completion.status,
    reviewerNote: completion.reviewer_note,
    recorded: justFinished
      ? {
          verified: verifiedParam === undefined ? null : verifiedParam === '1',
          reason: reasonParam ?? null,
          coverage: toNumber(coverageParam),
          requiredCoverage: toNumber(requiredParam),
        }
      : null,
  });
  const isVerified = outcome.state === 'verified';

  // Why the hike just recorded on a past-marked trail did not verify, in plain words
  const coverage = toNumber(coverageParam);
  const requiredCoverage = toNumber(requiredParam);
  const reviewReason = savedForReview
    ? describeReason(
        reasonParam && reasonParam !== 'ok' ? (reasonParam as VerificationReason) : null,
        coverage !== null ? coverage * 100 : null,
        requiredCoverage !== null ? requiredCoverage * 100 : null,
      )
    : null;

  // Only the track of the hike that produced this completion (or, while that hike is
  // still waiting to upload, the latest hike on this trail) may be exported from here.
  // A past completion has a track only when a recorded hike was filed under it.
  const exportPoints =
    lastHike &&
    lastHike.trailId === completion.trail_id &&
    (lastHike.completionId === completion.id || (!past && !lastHike.completionId))
      ? lastHike.points
      : [];

  const handleShare = async () => {
    const pastYear = past ? pastHikeYear(completion) : null;
    const lines: string[] = [
      pastYear
        ? `🏔️ I hiked ${trail?.name_en ?? 'a trail'} in ${pastYear}!`
        : `🏔️ I completed ${trail?.name_en ?? 'a trail'}!`,
    ];
    if (hasActualTime) lines.push(`⏱️ Time: ${formatElapsedTime(completion.elapsed_seconds!)}`);
    if (trail?.distance_km != null) lines.push(`📏 Distance: ${formatDistance(trail.distance_km)}`);
    if (trail?.elevation_gain_m != null) lines.push(`⬆️ Elevation: ${formatElevation(trail.elevation_gain_m)}`);
    if (hasActualTime && hasEstimate) {
      const actualHours = completion.elapsed_seconds! / 3600;
      const diff = ((actualHours - estimatedHours) / estimatedHours) * 100;
      if (diff < 0) lines.push(`🔥 ${Math.abs(Math.round(diff))}% faster than estimated!`);
    }
    lines.push('#GeorgiaTrails');
    await Share.share({ message: lines.join('\n') });
  };

  const handleExportGpx = async () => {
    if (exportPoints.length === 0) {
      Alert.alert('No GPS data', 'No GPS track is available for this hike.');
      return;
    }
    try {
      const trailName = trail?.name_en ?? 'hike';
      const filename = `${trailName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`;
      const gpx = buildGpxString(trailName, exportPoints);
      const f = new FSFile(Paths.cache, filename);
      f.write(gpx);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        // The track stays on the phone afterwards: the share sheet resolves the same
        // way whether the file was saved or the sheet was dismissed.
        await Sharing.shareAsync(f.uri, { mimeType: 'application/gpx+xml', dialogTitle: 'Export GPX Track' });
      } else {
        Alert.alert('Sharing not available', 'Your device does not support file sharing.');
      }
    } catch {
      Alert.alert('Export failed', 'Could not export the GPX file. Please try again.');
    }
  };

  const outcomeColor =
    past || isVerified ? Colors.success : outcome.state === 'rejected' ? Colors.error : Colors.warning;

  // The share picture: the recorded track when this phone has it, else the trail's route
  const shareRoute =
    exportPoints.length >= 2
      ? exportPoints.map((p) => ({ lat: p.lat, lng: p.lng }))
      : parseGeoLineString(trailDetail?.route).map((c) => ({ lat: c.latitude, lng: c.longitude }));
  const shareData = {
    trailName: trail?.name_en ?? 'A trail in Georgia',
    subtitle: [trail?.region, past ? pastHikeYear(completion) : cardDate(completion.completed_at)].filter(Boolean).join(' · '),
    stats: cardStats({
      distanceKm: trail?.distance_km,
      ascentM: trail?.elevation_gain_m,
      elapsedSeconds: completion.elapsed_seconds,
      timeIsReal:
        hasActualTime && isPlausibleHikeTime(completion.elapsed_seconds ?? 0, trail?.distance_km ?? null),
    }),
    route: shareRoute,
  };

  return (
    <View style={styles.container}>
      <Confetti visible={showConfetti} />
      <BadgeUnlockModal
        badges={newBadges}
        visible={showBadgeModal}
        onClose={() => setShowBadgeModal(false)}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {/* Cover Image */}
        {trail?.cover_image_url ? (
          <Image source={{ uri: trail.cover_image_url }} style={styles.coverImage} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Icon name="trail-sign-outline" size={48} color={Colors.textLight} />
          </View>
        )}

        {/* Back button overlay */}
        <TouchableOpacity
          style={[styles.backIcon, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {/* Share button overlay */}
        <TouchableOpacity
          style={[styles.shareIcon, { top: insets.top + 8 }]}
          onPress={() => setShareOpen(true)}
          accessibilityLabel="Share your hike"
          accessibilityRole="button"
        >
          <Icon name="share-outline" size={22} color={Colors.text} />
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
                <Icon name="location-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.regionText}>{trail.region}</Text>
              </View>
            )}
          </View>

          {/* Completion date and whether it counts */}
          {past ? (
            <View style={[styles.dateRow, { backgroundColor: outcomeColor + '15' }]}>
              <Icon name="checkmark-circle" size={20} color={outcomeColor} />
              <View style={styles.dateTextWrap}>
                <Text style={styles.dateText}>{completionDateLabel(completion)}</Text>
                <Text style={[styles.outcomeTitle, { color: outcomeColor }]}>Marked as done by you</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.dateRow, { backgroundColor: outcomeColor + '15' }]}>
              <Icon
                name={isVerified ? 'checkmark-circle' : outcome.state === 'rejected' ? 'close-circle' : 'alert-circle'}
                size={20}
                color={outcomeColor}
              />
              <View style={styles.dateTextWrap}>
                <Text style={styles.dateText}>
                  {isVerified ? 'Completed' : 'Recorded'} on {formatDate(completion.completed_at)}
                </Text>
                <Text style={[styles.outcomeTitle, { color: outcomeColor }]}>{outcome.title}</Text>
              </View>
            </View>
          )}

          {past ? (
            <Text style={styles.outcomeDetail}>
              It counts on your profile, in My Georgia and for badges. The leaderboard counts only hikes recorded with the app.
            </Text>
          ) : (
            outcome.detail && <Text style={styles.outcomeDetail}>{outcome.detail}</Text>
          )}

          {savedForReview ? (
            <Text style={styles.outcomeDetail}>
              Your hike was saved and will be reviewed; the trail stays marked as done. {reviewReason}
            </Text>
          ) : (
            past &&
            completion.pending_hike_id && (
              <Text style={styles.outcomeDetail}>
                Your recorded hike on this trail is being reviewed. If it is approved, it replaces this mark.
              </Text>
            )
          )}

          {justFinished && !savedForReview && already === '1' && (
            <Text style={styles.outcomeDetail}>
              You had already completed this trail, so your earlier completion is the one shown here.
            </Text>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {hasActualTime && (
              <View style={styles.statCard}>
                <Icon name="timer-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>
                  {formatElapsedTime(completion.elapsed_seconds!)}
                </Text>
                <Text style={styles.statLabel}>Your Time</Text>
              </View>
            )}

            {trail?.distance_km != null && (
              <View style={styles.statCard}>
                <Icon name="map-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{formatDistance(trail.distance_km)}</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            )}

            {trail?.elevation_gain_m != null && (
              <View style={styles.statCard}>
                <Icon name="trending-up-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{formatElevation(trail.elevation_gain_m)}</Text>
                <Text style={styles.statLabel}>Elevation</Text>
              </View>
            )}

            {hasEstimate && (
              <View style={styles.statCard}>
                <Icon name="hourglass-outline" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{formatDuration(estimatedHours)}</Text>
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
                <Icon name="swap-horizontal" size={24} color={Colors.textLight} />
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonValue}>
                    {formatDuration(estimatedHours)}
                  </Text>
                  <Text style={styles.comparisonLabel}>Estimated</Text>
                </View>
              </View>
              {(() => {
                const actualHours = completion.elapsed_seconds! / 3600;
                const diff = ((actualHours - estimatedHours) / estimatedHours) * 100;
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

          {/* Right after a recorded hike: rate the trail and say how it was, in a tap */}
          {justFinished && !past && completion.trail_id ? <HowWasTheTrail trailId={completion.trail_id} /> : null}

          {/* The picture for Instagram stories and the rest */}
          {!past ? (
            <TouchableOpacity
              style={[styles.viewTrailButton, styles.shareHikeButton]}
              onPress={() => setShareOpen(true)}
              accessibilityRole="button"
              testID="share-hike"
            >
              <Icon name="share-social-outline" size={20} color={Colors.primary} />
              <Text style={styles.viewTrailText}>Share your hike</Text>
            </TouchableOpacity>
          ) : null}

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.profileButton}
            // Pops back to the tabs already underneath instead of stacking a second set
            onPress={() => router.dismissTo('/(tabs)/profile')}
          >
            <Icon name="person-outline" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.profileButtonText}>Go to Profile</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.viewTrailButton}
              onPress={() => router.push(`/trail/${completion.trail_id}`)}
            >
              <Icon name="trail-sign-outline" size={20} color={Colors.primary} />
              <Text style={styles.viewTrailText}>View Trail</Text>
            </TouchableOpacity>

            {exportPoints.length > 0 && (
              <TouchableOpacity style={styles.gpxButton} onPress={handleExportGpx}>
                <Icon name="download-outline" size={20} color={Colors.accent} />
                <Text style={styles.gpxButtonText}>Export GPX</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
      <ShareHikeSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        data={shareData}
        onShareText={handleShare}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  shareHikeButton: {
    flex: 0,
    marginTop: 16,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButton: {
    marginBottom: 12,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  dateTextWrap: {
    flex: 1,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  outcomeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  outcomeDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginTop: -8,
    marginBottom: 20,
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
