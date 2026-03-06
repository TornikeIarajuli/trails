import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrail } from '../../../hooks/useTrails';
import { useAuthStore } from '../../../store/authStore';
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
import { Button } from '../../../components/ui/Button';
import { parseGeoPoint, parseGeoLineString } from '../../../utils/geo';
import { mediaService } from '../../../services/media';
import { useUploadPhoto } from '../../../hooks/useCommunity';
import { useTrailReviews } from '../../../hooks/useReviews';
import { useActiveHikerCount } from '../../../hooks/useCompletions';
import { ReviewsList } from '../../../components/trail/ReviewsList';
import { WriteReviewModal } from '../../../components/trail/WriteReviewModal';
import { WeatherCard } from '../../../components/trail/WeatherCard';
import { trailCache } from '../../../utils/trailCache';
import { analytics } from '../../../utils/analytics';
import { localName } from '../../../utils/i18n';

export default function TrailDetailScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const { data: trail, isLoading } = useTrail(id);
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const uploadPhotoMutation = useUploadPhoto();
  const { data: reviews = [] } = useTrailReviews(id);
  const { data: activeCount } = useActiveHikerCount(id);

  const [isSavedOffline, setIsSavedOffline] = useState(() =>
    trailCache.isTrailSavedOffline(id),
  );

  // Cache trail data when loaded + track view
  React.useEffect(() => {
    if (trail) {
      trailCache.setTrailDetail(id, trail);
      analytics.trailViewed(id, trail.name_en);
    }
  }, [trail, id]);

  const startPoint = trail ? parseGeoPoint(trail.start_point) : null;

  const toggleOfflineSave = () => {
    if (isSavedOffline) {
      trailCache.removeOfflineTrail(id);
      setIsSavedOffline(false);
    } else if (trail) {
      trailCache.saveTrailOffline(id, trail);
      setIsSavedOffline(true);
      Alert.alert('Saved', 'Trail saved for offline viewing');
    }
  };

  if (isLoading || !trail) return <LoadingSpinner />;

  const name = localName(trail.name_en, trail.name_ka, language);
  const description =
    language === 'ka' && trail.description_ka
      ? trail.description_ka
      : trail.description_en;

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'photo.jpg';
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const { url } = await mediaService.uploadHikePhoto(id, asset.uri, fileName, mimeType);
        uploadPhotoMutation.mutate({ trail_id: id, url });
      } catch {
        Alert.alert('Error', 'Failed to upload photo');
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TrailPhotoCarousel coverUrl={trail.cover_image_url} media={trail.media} />

        {/* Back button overlay */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {/* Top-right overlay buttons */}
        <View style={[styles.topRightButtons, { top: insets.top + 8 }]}>
          <TouchableOpacity style={styles.overlayButton} onPress={toggleOfflineSave}>
            <Ionicons
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
            >
              <Ionicons name="pencil" size={20} color={Colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {trail.status && trail.status !== 'open' && (
          <View style={[styles.statusBanner, STATUS_BANNER_BG[trail.status]]}>
            <Ionicons
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
            <DifficultyBadge difficulty={trail.difficulty} size="md" />
            <Text style={styles.region}>{trail.region}</Text>
          </View>

          <Text style={styles.name}>{name}</Text>

          <TrailStats
            distanceKm={trail.distance_km}
            elevationGainM={trail.elevation_gain_m}
            estimatedHours={trail.estimated_hours}
          />

          {trail.avg_rating !== null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={18} color="#FFB800" />
              <Text style={styles.rating}>{trail.avg_rating}</Text>
              <Text style={styles.reviewCount}>({trail.review_count} reviews)</Text>
            </View>
          )}

          {activeCount != null && activeCount > 0 && (
            <View style={styles.activeHikersRow}>
              <Text style={styles.activeHikersText}>🥾 {activeCount} hiker{activeCount !== 1 ? 's' : ''} currently on this trail</Text>
            </View>
          )}

          {/* Weather */}
          <WeatherCard
            latitude={startPoint?.latitude ?? null}
            longitude={startPoint?.longitude ?? null}
          />

          {/* Elevation Profile */}
          <ElevationProfile
            checkpoints={trail.checkpoints}
            distanceKm={trail.distance_km}
          />

          {/* Conditions Banner */}
          {trail.recent_conditions && trail.recent_conditions.length > 0 && (
            <ConditionsBanner
              conditions={trail.recent_conditions}
              onPress={() => router.push(`/trail/${id}/conditions`)}
            />
          )}

          {/* Report condition link */}
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.reportLink}
              onPress={() => setConditionModalVisible(true)}
            >
              <Ionicons name="flag-outline" size={16} color={Colors.primary} />
              <Text style={styles.reportLinkText}>Report Trail Condition</Text>
            </TouchableOpacity>
          )}

          {description && (
            <Text style={styles.description}>{description}</Text>
          )}

          <TrailMap
            route={parseGeoLineString(trail.route)}
            startPoint={parseGeoPoint(trail.start_point) ?? undefined}
            endPoint={parseGeoPoint(trail.end_point) ?? undefined}
            checkpoints={trail.checkpoints}
            height={220}
          />

          <CheckpointList checkpoints={trail.checkpoints} />

          {/* Upcoming Group Hikes */}
          <TouchableOpacity
            style={styles.sectionLink}
            onPress={() => router.push(`/trail/${id}/events` as any)}
          >
            <Ionicons name="people-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionLinkText}>Upcoming Group Hikes</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Community Photos */}
          <CommunityPhotos
            trailId={id}
            photosCount={trail.photos_count}
            onViewAll={() => router.push(`/trail/${id}/photos`)}
            onAddPhoto={handleAddPhoto}
          />

          {/* Reviews */}
          <ReviewsList
            reviews={reviews}
            trailId={id}
            onWriteReview={() => setReviewModalVisible(true)}
          />
        </View>
      </ScrollView>

      {/* Start Hike button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Button
          title={isAuthenticated ? 'Start Hike' : 'Log in to Start'}
          onPress={() => {
            if (isAuthenticated) {
              router.push(`/trail/${id}/hike`);
            } else {
              router.push('/(auth)/login');
            }
          }}
        />
      </View>

      {/* Report Condition Modal */}
      <ReportConditionModal
        trailId={id}
        visible={conditionModalVisible}
        onClose={() => setConditionModalVisible(false)}
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
    gap: 6,
    paddingHorizontal: 16,
  },
  reportLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
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
