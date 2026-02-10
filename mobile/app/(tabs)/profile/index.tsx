import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useAuthStore } from '../../../store/authStore';
import { usersService } from '../../../services/users';
import { mediaService } from '../../../services/media';
import { useMyCompletions, useDeleteCompletion } from '../../../hooks/useCompletions';
import { Avatar } from '../../../components/ui/Avatar';
import { StatsGrid } from '../../../components/profile/StatsGrid';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailDifficulty } from '../../../types/trail';
import { DifficultyBadge } from '../../../components/trail/DifficultyBadge';
import { BadgeCard } from '../../../components/badges/BadgeCard';
import { formatDate } from '../../../utils/formatters';
import { useMyBadges } from '../../../hooks/useBadges';
import { useMyBookmarks } from '../../../hooks/useBookmarks';
import { useFollowCounts } from '../../../hooks/useFollows';

export default function ProfileScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => usersService.getMyProfile(),
    enabled: isAuthenticated,
  });

  const { data: completions } = useMyCompletions();
  const deleteCompletion = useDeleteCompletion();
  const { data: myBadges } = useMyBadges();
  const { data: bookmarksData } = useMyBookmarks();
  const { data: followCounts } = useFollowCounts(profile?.id ?? '');

  const handleDeleteCompletion = (id: string, trailName: string) => {
    Alert.alert(
      'Delete Completion',
      `Remove "${trailName}" from your history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCompletion.mutate(id),
        },
      ],
    );
  };

  const avatarMutation = useMutation({
    mutationFn: async (uri: string) => {
      const fileName = uri.split('/').pop() || 'avatar.jpg';
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      return mediaService.uploadAvatar(uri, fileName, mimeType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to upload avatar');
    },
  });

  const profileMutation = useMutation({
    mutationFn: (data: { full_name?: string; bio?: string }) =>
      usersService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update profile');
    },
  });

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      avatarMutation.mutate(result.assets[0].uri);
    }
  };

  const startEditing = () => {
    setEditName(profile?.full_name || '');
    setEditBio(profile?.bio || '');
    setEditing(true);
  };

  const saveProfile = () => {
    profileMutation.mutate({
      full_name: editName.trim() || undefined,
      bio: editBio.trim() || undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loginPrompt}>Log in to see your profile</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (profileLoading) return <LoadingSpinner />;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile/settings')}>
          <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {profile && (
        <>
          <View style={styles.profileCard}>
            <TouchableOpacity onPress={pickAvatar} disabled={avatarMutation.isPending}>
              <Avatar
                uri={profile.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : null}
                name={profile.full_name || profile.username}
                size={80}
              />
              <View style={styles.editBadge}>
                <Ionicons
                  name={avatarMutation.isPending ? 'hourglass-outline' : 'camera'}
                  size={14}
                  color="#fff"
                />
              </View>
            </TouchableOpacity>
            <Text style={styles.username}>{profile.username}</Text>
            {!editing && profile.full_name && (
              <Text style={styles.fullName}>{profile.full_name}</Text>
            )}
            {!editing && (
              <Text style={styles.bio}>
                {profile.bio || 'No bio yet. Tap edit to add one.'}
              </Text>
            )}

            {editing ? (
              <View style={styles.editForm}>
                <TextInput
                  style={styles.editInput}
                  placeholder="Full name"
                  placeholderTextColor={Colors.textLight}
                  value={editName}
                  onChangeText={setEditName}
                />
                <TextInput
                  style={[styles.editInput, styles.editBioInput]}
                  placeholder="Write something about yourself..."
                  placeholderTextColor={Colors.textLight}
                  value={editBio}
                  onChangeText={setEditBio}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setEditing(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveProfile}
                    disabled={profileMutation.isPending}
                  >
                    <Text style={styles.saveButtonText}>
                      {profileMutation.isPending ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.editProfileButton} onPress={startEditing}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {followCounts && (
            <View style={styles.followRow}>
              <TouchableOpacity
                style={styles.followItem}
                onPress={() =>
                  router.push(`/trail/user/followers?userId=${profile.id}&tab=followers`)
                }
              >
                <Text style={styles.followNumber}>{followCounts.followers_count}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.followDivider} />
              <TouchableOpacity
                style={styles.followItem}
                onPress={() =>
                  router.push(`/trail/user/followers?userId=${profile.id}&tab=following`)
                }
              >
                <Text style={styles.followNumber}>{followCounts.following_count}</Text>
                <Text style={styles.followLabel}>Following</Text>
              </TouchableOpacity>
            </View>
          )}

          <StatsGrid stats={profile.stats} />

          {/* Badges Section */}
          {myBadges && myBadges.length > 0 && (
            <View style={styles.badgesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Badges ({myBadges.length})</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile/badges')}>
                  <Text style={styles.viewAllLink}>View All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.badgesScroll}
              >
                {myBadges.map((ub) => (
                  <BadgeCard key={ub.id} badge={ub.badges} earned compact />
                ))}
              </ScrollView>
            </View>
          )}

          {completions && completions.length > 0 && (
            <View style={styles.completionsSection}>
              <Text style={styles.sectionTitle}>Completed Trails</Text>
              {completions.map((c) => (
                <View key={c.id} style={styles.completionRow}>
                  <TouchableOpacity
                    style={styles.completionTouchable}
                    onPress={() => router.push(`/trail/completion/${c.id}`)}
                  >
                    <View style={styles.completionInfo}>
                      <Text style={styles.completionName} numberOfLines={1}>
                        {c.trails?.name_en ?? 'Unknown Trail'}
                      </Text>
                      <Text style={styles.completionDate}>{formatDate(c.completed_at)}</Text>
                    </View>
                    {c.trails?.difficulty && (
                      <DifficultyBadge difficulty={c.trails.difficulty as TrailDifficulty} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteCompletion(c.id, c.trails?.name_en ?? 'this trail')}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Bookmarked Trails */}
          {bookmarksData && bookmarksData.data.length > 0 && (
            <View style={styles.completionsSection}>
              <Text style={styles.sectionTitle}>Bookmarked Trails</Text>
              {bookmarksData.data.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.completionRow}
                  onPress={() => router.push(`/trail/${b.trails.id}`)}
                >
                  <View style={styles.completionInfo}>
                    <Text style={styles.completionName} numberOfLines={1}>
                      {b.trails.name_en}
                    </Text>
                    <Text style={styles.completionDate}>{b.trails.region}</Text>
                  </View>
                  {b.trails.difficulty && (
                    <DifficultyBadge difficulty={b.trails.difficulty as TrailDifficulty} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
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
    marginTop: 8,
    paddingHorizontal: 32,
    fontStyle: 'italic',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  editForm: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 12,
    gap: 10,
  },
  editInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  editBioInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  followItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  followNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  followLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  followDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  completionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  completionTouchable: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  completionInfo: {
    flex: 1,
    marginRight: 12,
  },
  deleteButton: {
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  completionDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  loginPrompt: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginButtonText: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  badgesSection: {
    paddingBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  badgesScroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
});
