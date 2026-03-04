import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { usersService } from '../../../services/users';
import { Avatar } from '../../../components/ui/Avatar';
import { StatsGrid } from '../../../components/profile/StatsGrid';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { PublicProfile, TrailCompletion } from '../../../types/user';
import { useAuthStore } from '../../../store/authStore';
import { useIsFollowing, useToggleFollow, useFollowCounts } from '../../../hooks/useFollows';

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
      {trail.cover_image_url ? (
        <Image source={{ uri: trail.cover_image_url }} style={styles.trailImage} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.trailImage, styles.trailImagePlaceholder]}>
          <Ionicons name="image-outline" size={24} color={Colors.textLight} />
        </View>
      )}
      <View style={styles.completionInfo}>
        <Text style={styles.trailName} numberOfLines={1}>{trail.name_en}</Text>
        <View style={styles.trailMeta}>
          <DifficultyBadgeLocal difficulty={trail.difficulty} Colors={Colors} styles={styles} />
          <Text style={styles.trailRegion}>{trail.region}</Text>
        </View>
        <View style={styles.trailDetails}>
          {trail.distance_km && (
            <Text style={styles.detailText}>{trail.distance_km} km</Text>
          )}
          {trail.elevation_gain_m && (
            <Text style={styles.detailText}>{trail.elevation_gain_m}m gain</Text>
          )}
        </View>
        <Text style={styles.completedDate}>Completed {formatDate(completion.completed_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ProofPhotosGrid({ completions, Colors, styles }: { completions: TrailCompletion[]; Colors: ColorPalette; styles: any }) {
  const photosWithTrail = completions.filter(c => c.proof_photo_url);
  if (photosWithTrail.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Trail Photos</Text>
      <View style={styles.photoGrid}>
        {photosWithTrail.map((c) => (
          <View key={c.id} style={styles.photoContainer}>
            <Image source={{ uri: c.proof_photo_url! }} style={styles.proofPhoto} cachePolicy="memory-disk" />
            <Text style={styles.photoCaption} numberOfLines={1}>
              {c.trails?.name_en}
            </Text>
          </View>
        ))}
      </View>
    </View>
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
        <ActivityIndicator size="small" color={isFollowing ? Colors.primary : '#fff'} />
      ) : (
        <>
          <Ionicons
            name={isFollowing ? 'checkmark' : 'person-add-outline'}
            size={16}
            color={isFollowing ? Colors.primary : '#fff'}
          />
          <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </>
      )}
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
    queryKey: ['myEmergencyContact'],
    queryFn: () => usersService.getMyEmergencyContactId(),
    enabled: !!currentUserId,
  });

  const setContact = useMutation({
    mutationFn: (contactId: string | null) => usersService.setEmergencyContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myEmergencyContact'] });
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
        'They will be notified now and if you trigger an SOS during a hike.',
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
          <Ionicons
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
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ['publicProfile', id],
    queryFn: () => usersService.getPublicProfile(id),
    enabled: !!id,
  });

  if (isLoading || !profile) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: profile.username,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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

          <FollowCounts userId={id} Colors={Colors} styles={styles} />
          <FollowButton userId={id} Colors={Colors} styles={styles} />
          <EmergencyContactButton userId={id} Colors={Colors} styles={styles} />

          <Text style={styles.memberSince}>
            Member since {formatDate(profile.created_at)}
          </Text>
        </View>

        {/* Stats */}
        {profile.stats && <StatsGrid stats={profile.stats} />}

        {/* Proof Photos */}
        <ProofPhotosGrid completions={profile.completions} Colors={Colors} styles={styles} />

        {/* Completed Trails */}
        {profile.completions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Completed Trails ({profile.completions.length})
            </Text>
            {profile.completions.map((completion) => (
              <CompletionCard key={completion.id} completion={completion} Colors={Colors} styles={styles} />
            ))}
          </View>
        )}

        {profile.completions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="footsteps-outline" size={48} color={Colors.borderLight} />
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
    color: '#fff',
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
    width: 90,
    height: 90,
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoContainer: {
    width: '31%',
  },
  proofPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
  },
  photoCaption: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
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
