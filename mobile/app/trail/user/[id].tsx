import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../../components/ui/Icon';
import { useColors, ColorPalette } from '../../../constants/colors';
import { usersService } from '../../../services/users';
import { Avatar } from '../../../components/ui/Avatar';
import { StatsGrid } from '../../../components/profile/StatsGrid';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { TrailCover } from '../../../components/trail/TrailCover';
import { ContentMenu } from '../../../components/moderation/ContentMenu';
import { PublicProfile, TrailCompletion } from '../../../types/user';
import { useAuthStore } from '../../../store/authStore';
import { useIsFollowing, useToggleFollow, useFollowCounts } from '../../../hooks/useFollows';
import { useBlockedUserIds } from '../../../hooks/useModeration';
import { queryKeys } from '../../../utils/queryKeys';
import { getErrorMessage, getErrorStatus } from '../../../utils/showError';
import { useRegionProgress } from '../../../hooks/useRegionProgress';
import { completionDateLabel, isPastHike } from '../../../utils/pastHikes';
import { withBottomInset } from '../../../utils/insets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InstagramLink } from '../../../components/profile/InstagramLink';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getOnlineStatus(lastSeenAt: string | null): { online: boolean; label: string } {
  if (!lastSeenAt) return { online: false, label: 'Offline' };
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_THRESHOLD_MS) return { online: true, label: 'Online' };
  const m = Math.floor(diff / 60000);
  if (m < 60) return { online: false, label: `Last seen ${m}m ago` };
  const h = Math.floor(m / 60);
  if (h < 24) return { online: false, label: `Last seen ${h}h ago` };
  const d = Math.floor(h / 24);
  if (d < 7) return { online: false, label: `Last seen ${d}d ago` };
  return { online: false, label: `Last seen ${formatDate(lastSeenAt)}` };
}

function DifficultyBadgeLocal({ difficulty, Colors, styles }: { difficulty: string; Colors: ColorPalette; styles: any }) {
  const color = Colors.difficulty[difficulty as keyof typeof Colors.difficulty] || Colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{difficulty}</Text>
    </View>
  );
}

function CompletionCard({ completion, Colors, styles }: { completion: TrailCompletion; Colors: ColorPalette; styles: any }) {
  const trail = completion.trails;
  if (!trail) return null;

  return (
    <TouchableOpacity
      style={styles.completionCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/trail/${trail.id}`)}
    >
      <TrailCover uri={trail.cover_image_url} style={styles.trailImage} iconSize={24} />
      <View style={styles.completionInfo}>
        <Text style={styles.trailName} numberOfLines={1}>{trail.name_en}</Text>
        <View style={styles.trailMeta}>
          <DifficultyBadgeLocal difficulty={trail.difficulty} Colors={Colors} styles={styles} />
          <Text style={styles.trailRegion}>{trail.region}</Text>
        </View>
        <View style={styles.trailDetails}>
          {trail.distance_km != null && trail.distance_km > 0 && (
            <Text style={styles.detailText}>{trail.distance_km} km</Text>
          )}
          {trail.elevation_gain_m != null && trail.elevation_gain_m > 0 && (
            <Text style={styles.detailText}>{trail.elevation_gain_m}m gain</Text>
          )}
        </View>
        <Text style={styles.completedDate}>
          {isPastHike(completion) ? completionDateLabel(completion) : `Completed ${formatDate(completion.completed_at)}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function FollowButton({ userId, Colors, styles }: { userId: string; Colors: ColorPalette; styles: any }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: followData, isLoading } = useIsFollowing(userId);
  const toggleFollow = useToggleFollow();

  if (!currentUserId || currentUserId === userId) return null;

  const isFollowing = followData?.following ?? false;

  return (
    <TouchableOpacity
      style={[styles.followButton, isFollowing && styles.followButtonActive]}
      onPress={() => toggleFollow.mutate(userId)}
      disabled={toggleFollow.isPending || isLoading}
    >
      {toggleFollow.isPending ? (
        <ActivityIndicator size="small" color={isFollowing ? Colors.primary : Colors.textOnPrimary} />
      ) : (
        <>
          <Icon
            name={isFollowing ? 'checkmark' : 'person-add-outline'}
            size={16}
            color={isFollowing ? Colors.primary : Colors.textOnPrimary}
          />
          <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function RegionsRow({ userId, Colors, styles }: { userId: string; Colors: ColorPalette; styles: any }) {
  const { data } = useRegionProgress(userId);
  // Hidden while loading and on servers without region progress
  if (!data?.totals) return null;
  const { regions_started, regions_total } = data.totals;

  return (
    <TouchableOpacity
      style={styles.regionsRow}
      onPress={() => router.push({ pathname: '/trail/user/regions', params: { userId } } as any)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Regions explored: ${regions_started} of ${regions_total}`}
    >
      <Icon name="map-outline" size={18} color={Colors.primary} />
      <Text style={styles.regionsRowLabel}>Regions explored</Text>
      <Text style={styles.regionsRowValue}>
        {regions_started}/{regions_total}
      </Text>
      <Icon name="chevron-forward" size={16} color={Colors.textLight} />
    </TouchableOpacity>
  );
}

function FollowCounts({ userId, Colors, styles }: { userId: string; Colors: ColorPalette; styles: any }) {
  const { data: counts } = useFollowCounts(userId);

  if (!counts) return null;

  return (
    <View style={styles.countsRow}>
      <TouchableOpacity
        style={styles.countItem}
        onPress={() => router.push(`/trail/user/followers?userId=${userId}&tab=followers`)}
      >
        <Text style={styles.countNumber}>{counts.followers_count}</Text>
        <Text style={styles.countLabel}>Followers</Text>
      </TouchableOpacity>
      <View style={styles.countDivider} />
      <TouchableOpacity
        style={styles.countItem}
        onPress={() => router.push(`/trail/user/followers?userId=${userId}&tab=following`)}
      >
        <Text style={styles.countNumber}>{counts.following_count}</Text>
        <Text style={styles.countLabel}>Following</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmergencyContactButton({ userId, Colors, styles }: { userId: string; Colors: ColorPalette; styles: any }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const { data: myContactId } = useQuery<string | null>({
    queryKey: queryKeys.emergencyContact(),
    queryFn: () => usersService.getMyEmergencyContactId(),
    enabled: !!currentUserId,
  });

  const setContact = useMutation({
    mutationFn: (contactId: string | null) => usersService.setEmergencyContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emergencyContact() });
    },
    onError: (err) => {
      Alert.alert('Error', getErrorMessage(err, 'Could not update your emergency contact.'));
    },
  });

  if (!currentUserId || currentUserId === userId) return null;

  const isMyContact = myContactId === userId;

  const handlePress = () => {
    if (isMyContact) {
      Alert.alert(
        'Remove Emergency Contact',
        'Remove this person as your emergency contact?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => setContact.mutate(null) },
        ],
      );
    } else {
      Alert.alert(
        'Set Emergency Contact',
        'They get a push notification now, and another one with your location if you send an SOS during a hike.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set', onPress: () => setContact.mutate(userId) },
        ],
      );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.emergencyButton, isMyContact && styles.emergencyButtonActive]}
      onPress={handlePress}
      disabled={setContact.isPending}
    >
      {setContact.isPending ? (
        <ActivityIndicator size="small" color={isMyContact ? Colors.error : '#fff'} />
      ) : (
        <>
          <Icon
            name={isMyContact ? 'shield-checkmark' : 'shield-outline'}
            size={16}
            color={isMyContact ? Colors.error : '#fff'}
          />
          <Text style={[styles.emergencyButtonText, isMyContact && styles.emergencyButtonTextActive]}>
            {isMyContact ? 'Emergency Contact ✓' : 'Set as Emergency Contact'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const blockedIds = useBlockedUserIds();

  const { data: profile, isLoading, error, refetch, isRefetching } = useQuery<PublicProfile>({
    queryKey: queryKeys.follows.publicProfile(id),
    queryFn: () => usersService.getPublicProfile(id),
    enabled: !!id,
  });

  const headerOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: Colors.background },
    headerTintColor: Colors.text,
    headerTitleStyle: { color: Colors.text },
    headerShadowVisible: false,
  };

  if (!profile) {
    if (isLoading) return <LoadingSpinner />;
    const gone = getErrorStatus(error) === 404;
    return (
      <>
        <Stack.Screen options={{ ...headerOptions, title: 'Profile' }} />
        <ErrorState
          error={error}
          title={gone ? 'This account no longer exists' : "Couldn't load this profile"}
          message={gone ? 'It may have been deleted.' : undefined}
          onRetry={gone ? undefined : () => refetch()}
          retrying={isRefetching}
        />
      </>
    );
  }

  const isBlocked = blockedIds.has(id);
  const completions = profile.completions ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          ...headerOptions,
          title: profile.username,
          headerRight:
            currentUserId && currentUserId !== id
              ? () => (
                  <ContentMenu
                    style={styles.headerMenu}
                    targetType="user"
                    targetId={id}
                    targetLabel="profile"
                    authorId={id}
                    authorName={profile.username}
                    iconSize={22}
                    iconColor={Colors.text}
                  />
                )
              : undefined,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={withBottomInset(styles.content, insets.bottom)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {isBlocked && (
          <View style={styles.blockedNotice}>
            <Icon name="ban-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.blockedText}>
              You blocked this user, so their activity is hidden from you. Use the menu at the top to unblock them.
            </Text>
          </View>
        )}
        {/* Profile Header */}
        <View style={styles.profileCard}>
          <Avatar
            uri={profile.avatar_url}
            name={profile.full_name || profile.username}
            size={80}
          />
          <Text style={styles.username}>{profile.username}</Text>
          {(() => {
            const { online, label } = getOnlineStatus(profile.last_seen_at ?? null);
            return (
              <View style={styles.onlineRow}>
                <View style={[styles.onlineDot, online ? styles.onlineDotActive : styles.onlineDotInactive]} />
                <Text style={[styles.onlineLabel, online && styles.onlineLabelActive]}>{label}</Text>
              </View>
            );
          })()}
          {profile.full_name && (
            <Text style={styles.fullName}>{profile.full_name}</Text>
          )}
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Text style={styles.bioEmpty}>No bio yet</Text>
          )}
          {profile.instagram_handle ? (
            <InstagramLink handle={profile.instagram_handle} style={{ alignSelf: 'center', marginTop: 6 }} />
          ) : null}

          <FollowCounts userId={id} Colors={Colors} styles={styles} />
          <FollowButton userId={id} Colors={Colors} styles={styles} />
          <EmergencyContactButton userId={id} Colors={Colors} styles={styles} />

          <Text style={styles.memberSince}>
            Member since {formatDate(profile.created_at)}
          </Text>
        </View>

        {/* Stats (the regions summary has its own row below) */}
        {profile.stats && <StatsGrid stats={profile.stats} regionsFor={null} />}

        <RegionsRow userId={id} Colors={Colors} styles={styles} />

        {/* Completed Trails */}
        {completions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Completed Trails ({completions.length})
            </Text>
            {completions.map((completion) => (
              <CompletionCard key={completion.id} completion={completion} Colors={Colors} styles={styles} />
            ))}
          </View>
        )}

        {completions.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="footsteps-outline" size={48} color={Colors.borderLight} />
            <Text style={styles.emptyText}>No completed trails yet</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineDotActive: {
    backgroundColor: Colors.success,
  },
  onlineDotInactive: {
    backgroundColor: Colors.textLight,
  },
  onlineLabel: {
    fontSize: 12,
    color: Colors.textLight,
  },
  onlineLabelActive: {
    color: Colors.success,
    fontWeight: '600',
  },
  fullName: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  bioEmpty: {
    fontSize: 14,
    color: Colors.textLight,
    fontStyle: 'italic',
    marginTop: 10,
  },
  headerMenu: {
    marginRight: 16,
  },
  regionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  regionsRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  regionsRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
  },
  blockedText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 0,
  },
  countItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  countNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  countLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  countDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    minWidth: 130,
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  followButtonTextActive: {
    color: Colors.primary,
  },
  memberSince: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 12,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  completionCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  trailImage: {
    // Fill the card's full height (it grows with the text and font size); a fixed
    // 90×90 square left a white strip under the photo.
    width: 96,
    minHeight: 96,
    alignSelf: 'stretch',
  },
  trailImagePlaceholder: {
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  trailName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  trailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  trailRegion: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  trailDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  completedDate: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textLight,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: Colors.error,
    minWidth: 130,
  },
  emergencyButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  emergencyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  emergencyButtonTextActive: {
    color: Colors.error,
  },
});
