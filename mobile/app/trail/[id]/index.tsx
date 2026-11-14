import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrail } from '../../../hooks/useTrails';
import { useAuthStore } from '../../../store/authStore';
import { useHikeStore } from '../../../store/hikeStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { TrailPhotoCarousel } from '../../../components/trail/TrailPhotoCarousel';
import { DifficultyBadge } from '../../../components/trail/DifficultyBadge';
import { TrailStats } from '../../../components/trail/TrailStats';
import { CheckpointList } from '../../../components/trail/CheckpointList';
import { TrailMap } from '../../../components/trail/TrailMap';
import { ElevationProfile } from '../../../components/trail/ElevationProfile';
import { BookmarkButton } from '../../../components/trail/BookmarkButton';
import { ShareButton } from '../../../components/trail/ShareButton';
import { ConditionsBanner } from '../../../components/trail/ConditionsBanner';
import { CommunityPhotos } from '../../../components/trail/CommunityPhotos';
import { ReportConditionModal } from '../../../components/community/ReportConditionModal';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Button } from '../../../components/ui/Button';
import { parseGeoPoint, parseGeoLineString } from '../../../utils/geo';
import { useAddTrailPhoto, useTrailConditions } from '../../../hooks/useCommunity';
import { useTrailReviews } from '../../../hooks/useReviews';
import { useActiveHikerCount } from '../../../hooks/useCompletions';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { ReviewsList } from '../../../components/trail/ReviewsList';
import { WriteReviewModal } from '../../../components/trail/WriteReviewModal';
import { WeatherCard } from '../../../components/trail/WeatherCard';
import { trailCache } from '../../../utils/trailCache';
import { analytics } from '../../../utils/analytics';
import { localName } from '../../../utils/i18n';
import { isRouteUnverified, UNVERIFIED_ROUTE_MESSAGE } from '../../../utils/trailReview';
import { TrailProblemModal } from '../../../components/trail/TrailProblemModal';
import { GearCard } from '../../../components/trail/GearCard';
import { TrailCompletionStatus } from '../../../components/trail/TrailCompletionStatus';
import { useGearPlan } from '../../../hooks/useGear';
import { useGearStore, localDay, shouldShowPrehikeCheck } from '../../../store/gearStore';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useOfflineMapsStore } from '../../../store/offlineMapsStore';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { TopoDownloadRow, startTopoDownload, topoDownloadSizeLabel } from '../../../components/trail/TopoDownloadRow';
import { LatLng, TilePlan, planTrailTiles } from '../../../utils/topoTiles';

const NO_TOPO_PLAN: TilePlan = { tiles: [], minZoom: 0, maxZoom: null, droppedZooms: [] };

export default function TrailDetailScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const hikeIsActive = useHikeStore((s) => s.isActive);
  const hikeTrailId = useHikeStore((s) => s.trailId);
  const {
    data: trail,
    isLoading,
    isError,
    error,
    refetch: refetchTrail,
    isRefetching,
    // Shown from the list the user tapped while the full trail loads: photo, name and stats
    // only. Sections built from detail-only fields wait for the real data.
    isPlaceholderData,
  } = useTrail(id);
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [problemModalVisible, setProblemModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const { addPhoto, isUploading } = useAddTrailPhoto(id);
  const reviewsQuery = useTrailReviews(id);
  const reviews = useWithoutBlocked(reviewsQuery.data, (review) => review.user_id);
  const refetchReviews = reviewsQuery.refetch;
  // The trail payload only carries its three newest reports; the banner needs all of them
  const { data: allConditions, refetch: refetchConditions } = useTrailConditions(id);
  const { data: activeCount, refetch: refetchCount } = useActiveHikerCount(id);
  const gear = useGearPlan(isPlaceholderData ? undefined : trail);
  const topoDownloading = useOfflineMapsStore((s) => (s.active?.trailId === id ? s.active : null));

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchTrail(), refetchReviews(), refetchCount(), refetchConditions()]);
    setRefreshing(false);
  }, [refetchTrail, refetchReviews, refetchCount, refetchConditions]);

  const [isSavedOffline, setIsSavedOffline] = useState(() =>
    trailCache.isTrailSavedOffline(id),
  );
  const isOffline = useNetworkStatus() === 'offline';

  // The topo tiles to save for this trail: around everything the map shows
  const topoPlan = useMemo(() => {
    if (!trail || isPlaceholderData) return NO_TOPO_PLAN;
    const points: LatLng[] = [
      ...parseGeoLineString(trail.route),
      ...[parseGeoPoint(trail.start_point), parseGeoPoint(trail.end_point)].filter((p): p is LatLng => !!p),
      ...(trail.checkpoints ?? [])
        .map((cp) => parseGeoPoint(cp.coordinates))
        .filter((p): p is LatLng => !!p),
    ];
    return planTrailTiles(points);
  }, [trail, isPlaceholderData]);

  // Cache trail data when loaded + track view (never the list stand-in: it would become the
  // "offline copy" and lack the route, checkpoints and media)
  React.useEffect(() => {
    if (trail && !isPlaceholderData) {
      trailCache.setTrailDetail(id, trail);
      analytics.trailViewed(id, trail.name_en);
    }
  }, [trail, id, isPlaceholderData]);

  const startPoint = trail ? parseGeoPoint(trail.start_point) : null;

  const toggleOfflineSave = () => {
    if (isPlaceholderData) return;
    if (isSavedOffline) {
      trailCache.removeOfflineTrail(id);
      setIsSavedOffline(false);
    } else if (trail) {
      trailCache.saveTrailOffline(id, trail);
      setIsSavedOffline(true);
      offerTopoDownload();
    }
  };

  // Saving the trail keeps its details; the topo map is offered alongside, never fetched unasked
  const offerTopoDownload = () => {
    const maps = useOfflineMapsStore.getState();
    maps.load();
    if (topoPlan.tiles.length === 0 || maps.saved[id] || maps.active?.trailId === id) {
      Alert.alert('Saved', 'Trail saved for offline viewing');
      return;
    }
    if (isOffline) {
      Alert.alert(
        'Saved',
        'Trail saved for offline viewing. Connect to the internet to also save its topo map.',
      );
      return;
    }
    Alert.alert(
      'Saved for offline viewing',
      `Also download the topo map for this trail (${topoDownloadSizeLabel(topoPlan)})? The map then works without signal.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => {
            if (trail) startTopoDownload(id, trail.name_en, topoPlan);
          },
        },
      ],
    );
  };

  if (!trail) {
    if (isLoading) return <LoadingSpinner />;
    return (
      <ErrorState
        error={error}
        title="Couldn't load this trail"
        onRetry={() => refetchTrail()}
        retrying={isRefetching}
        showBack
      />
    );
  }

  const name = localName(trail.name_en, trail.name_ka, language);
  const description =
    language === 'ka' && trail.description_ka
      ? trail.description_ka
      : trail.description_en;
  const checkpoints = trail.checkpoints ?? [];
  const conditions = allConditions ?? trail.recent_conditions ?? [];
  const conditionsTotal = allConditions ? allConditions.length : trail.conditions_count;

  const resumingThisHike = hikeIsActive && hikeTrailId === id;
  const otherActiveHikeTrailId = hikeIsActive && hikeTrailId && hikeTrailId !== id ? hikeTrailId : null;

  const openHike = () => router.push(`/trail/${id}/hike`);

  // Once a day, a new hike first shows the packing list while something essential is unticked.
  const openHikeAfterGearCheck = () => {
    const { ticks, prehikeShownOn } = useGearStore.getState();
    const showCheck =
      !!gear &&
      shouldShowPrehikeCheck({
        essentials: gear.plan.items.filter((i) => i.level === 'essential').map((i) => i.key),
        checked: [...(ticks[id]?.checked ?? []), ...(isSavedOffline ? ['offline_map'] : [])],
        shownOn: prehikeShownOn[id],
        today: localDay(),
      });
    if (showCheck) router.push(`/trail/${id}/gear?start=1`);
    else openHike();
  };

  const routeUnverified = isRouteUnverified(trail);

  const openProblemReport = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign in to report', 'Please log in to report a problem with this trail.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    setProblemModalVisible(true);
  };

  const explainUnverified = () => {
    Alert.alert('Unverified route', UNVERIFIED_ROUTE_MESSAGE, [
      { text: 'Close', style: 'cancel' },
      { text: 'Report a problem', onPress: openProblemReport },
    ]);
  };

  const handleStartHike = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    // One hike at a time: opening a second hike screen would keep recording the
    // first hike but file it under this trail.
    if (otherActiveHikeTrailId) {
      Alert.alert(
        'Hike in progress',
        'You are already recording a hike on another trail. End or discard it before starting a new one.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open active hike',
            onPress: () => router.push(`/trail/${otherActiveHikeTrailId}/hike`),
          },
        ],
      );
      return;
    }

    if (trail.status === 'closed' && !resumingThisHike) {
      const note = trail.status_note?.trim() || 'This trail is currently marked as closed.';
      Alert.alert('Trail closed', `${note}\n\nStart a hike here anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start anyway', style: 'destructive', onPress: openHikeAfterGearCheck },
      ]);
      return;
    }

    if (resumingThisHike) openHike();
    else openHikeAfterGearCheck();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <TrailPhotoCarousel coverUrl={trail.cover_image_url} media={trail.media ?? []} trailId={id} />

        {/* Back button overlay */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="back-button"
        >
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {/* Top-right overlay buttons */}
        <View style={[styles.topRightButtons, { top: insets.top + 8 }]}>
          <TouchableOpacity style={styles.overlayButton} onPress={toggleOfflineSave} accessibilityLabel={isSavedOffline ? 'Remove offline save' : 'Save for offline'} accessibilityRole="button">
            {/* While this trail's topo map downloads, a ring around the icon shows how far it is */}
            {topoDownloading && (
              <ProgressRing
                progress={topoDownloading.total > 0 ? topoDownloading.done / topoDownloading.total : 0}
                size={40}
                strokeWidth={3}
                color={Colors.primary}
                trackColor={Colors.borderLight}
                style={styles.overlayRing}
              />
            )}
            <Icon
              name={isSavedOffline ? 'download' : 'download-outline'}
              size={20}
              color={isSavedOffline ? Colors.primary : Colors.text}
            />
          </TouchableOpacity>
          <ShareButton trail={trail} />
          <BookmarkButton trailId={id} />
          {isAdmin && (
            <TouchableOpacity
              style={styles.overlayButton}
              onPress={() => router.push(`/trail/${id}/edit`)}
              accessibilityLabel="Edit trail"
              accessibilityRole="button"
            >
              <Icon name="pencil" size={20} color={Colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* The refresh failed but an earlier copy is on screen — say so, conditions may have changed */}
        {isError && (
          <ErrorState
            compact
            error={error}
            message="Couldn't refresh this trail — showing the last saved copy."
            onRetry={() => refetchTrail()}
            retrying={isRefetching}
            style={styles.staleNotice}
          />
        )}

        {trail.status && trail.status !== 'open' && (
          <View style={[styles.statusBanner, STATUS_BANNER_BG[trail.status]]}>
            <Icon
              name={trail.status === 'closed' ? 'close-circle' : 'warning'}
              size={18}
              color={STATUS_BANNER_ICON[trail.status]}
            />
            <View style={styles.statusBannerText}>
              <Text style={[styles.statusBannerTitle, { color: STATUS_BANNER_ICON[trail.status] }]}>
                Trail {STATUS_LABEL_DETAIL[trail.status]}
              </Text>
              {trail.status_note ? (
                <Text style={styles.statusBannerNote}>{trail.status_note}</Text>
              ) : null}
            </View>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.badgeRow}>
              <DifficultyBadge difficulty={trail.difficulty} size="md" />
              {routeUnverified && (
                <TouchableOpacity
                  style={styles.unverifiedChip}
                  onPress={explainUnverified}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Unverified route. What does this mean?"
                >
                  <Icon name="information-circle-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.unverifiedText}>Unverified route</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.region}>{trail.region}</Text>
          </View>

          <Text style={styles.name}>{name}</Text>

          <TrailStats
            distanceKm={trail.distance_km}
            elevationGainM={trail.elevation_gain_m}
            estimatedHours={trail.estimated_hours}
          />

          {trail.avg_rating != null && (
            <View style={styles.ratingRow}>
              <Icon name="star" size={18} color="#FFB800" />
              <Text style={styles.rating}>{trail.avg_rating}</Text>
              <Text style={styles.reviewCount}>
                ({trail.review_count} review{trail.review_count === 1 ? '' : 's'})
              </Text>
            </View>
          )}

          {activeCount != null && activeCount > 0 && (
            <View style={styles.activeHikersRow}>
              <Text style={styles.activeHikersText}>🥾 {activeCount} hiker{activeCount !== 1 ? 's' : ''} currently on this trail</Text>
            </View>
          )}

          <TrailCompletionStatus trailId={id} hikeActiveHere={resumingThisHike} />

          {/* Weather */}
          <WeatherCard
            latitude={startPoint?.latitude ?? null}
            longitude={startPoint?.longitude ?? null}
          />

          {/* Elevation Profile */}
          <ElevationProfile
            profile={trail.elevation_profile}
            checkpoints={checkpoints}
            distanceKm={trail.distance_km}
            elevationGainM={trail.elevation_gain_m}
          />

          {gear && (
            <GearCard
              trailId={id}
              plan={gear.plan}
              gearNotes={trail.gear_notes}
              onPress={() => router.push(`/trail/${id}/gear`)}
            />
          )}

          {/* Conditions Banner */}
          {conditions.length > 0 && (
            <ConditionsBanner
              conditions={conditions}
              totalCount={conditionsTotal}
              onPress={() => router.push(`/trail/${id}/conditions`)}
            />
          )}

          {/* Report condition button */}
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.reportLink}
              onPress={() => setConditionModalVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Icon name="flag-outline" size={18} color={Colors.primary} />
              <Text style={styles.reportLinkText}>Report Trail Condition</Text>
              <Icon name="chevron-forward" size={16} color={Colors.textLight} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {/* Problems with the trail data itself (route, existence, details) */}
          <TouchableOpacity
            style={styles.reportLink}
            onPress={openProblemReport}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Icon name="alert-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.reportLinkText}>Report a problem with this trail</Text>
            <Icon name="chevron-forward" size={16} color={Colors.textLight} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {description && (
            <Text style={styles.description}>{description}</Text>
          )}

          {/* The map fits the route once, when it mounts, so it waits for the real route */}
          {isPlaceholderData ? (
            <View style={styles.mapLoading} />
          ) : (
            <>
              <TrailMap
                route={parseGeoLineString(trail.route)}
                startPoint={parseGeoPoint(trail.start_point) ?? undefined}
                endPoint={parseGeoPoint(trail.end_point) ?? undefined}
                checkpoints={checkpoints}
                height={220}
              />
              <TopoDownloadRow trailId={id} trailName={trail.name_en} plan={topoPlan} />
            </>
          )}

          <CheckpointList checkpoints={checkpoints} />

          {/* Upcoming Group Hikes */}
          <TouchableOpacity
            style={styles.sectionLink}
            onPress={() => router.push(`/trail/${id}/events` as any)}
            accessibilityRole="button"
          >
            <Icon name="people-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionLinkText}>Upcoming Group Hikes</Text>
            <Icon name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Community Photos */}
          <CommunityPhotos
            trailId={id}
            photosCount={trail.photos_count}
            onViewAll={() => router.push(`/trail/${id}/photos`)}
            onAddPhoto={addPhoto}
            isUploading={isUploading}
          />

          {/* Reviews */}
          <ReviewsList
            reviews={reviews}
            trailId={id}
            onWriteReview={() => setReviewModalVisible(true)}
            isError={reviewsQuery.isError}
            error={reviewsQuery.error}
            onRetry={() => refetchReviews()}
          />
        </View>
      </ScrollView>

      {/* Start Hike button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Button
          title={
            !isAuthenticated ? 'Log in to Start' : resumingThisHike ? 'Resume Hike' : 'Start Hike'
          }
          onPress={handleStartHike}
          loading={isPlaceholderData && isAuthenticated && !resumingThisHike}
        />
      </View>

      {/* Report Condition Modal */}
      <ReportConditionModal
        trailId={id}
        visible={conditionModalVisible}
        onClose={() => setConditionModalVisible(false)}
      />

      {/* Report a problem with the trail itself */}
      <TrailProblemModal
        trailId={id}
        visible={problemModalVisible}
        onClose={() => setProblemModalVisible(false)}
      />

      {/* Write Review Modal */}
      <WriteReviewModal
        trailId={id}
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
      />
    </View>
  );
}

const STATUS_LABEL_DETAIL: Record<string, string> = {
  closed: 'Closed',
  seasonal: 'Seasonally Closed',
  maintenance: 'Under Maintenance',
};
const STATUS_BANNER_BG: Record<string, object> = {
  closed: { backgroundColor: '#FEF2F2' },
  seasonal: { backgroundColor: '#FFFBEB' },
  maintenance: { backgroundColor: '#EFF6FF' },
};
const STATUS_BANNER_ICON: Record<string, string> = {
  closed: '#DC2626',
  seasonal: '#D97706',
  maintenance: '#2563EB',
};

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
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
  topRightButtons: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  overlayRing: {
    position: 'absolute',
  },
  overlayButton: {
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
    paddingTop: 16,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flexShrink: 1,
  },
  unverifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  unverifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  region: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
  },
  rating: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    marginHorizontal: 16,
  },
  sectionLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  activeHikersRow: {
    paddingHorizontal: 16,
  },
  activeHikersText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  staleNotice: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  mapLoading: {
    height: 220,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  statusBannerText: {
    flex: 1,
    gap: 2,
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBannerNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
