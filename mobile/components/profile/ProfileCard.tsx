import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../ui/Icon';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';
import { usersService } from '../../services/users';
import { mediaService, describeImageUpload, getUploadErrorMessage } from '../../services/media';
import { UserProfile } from '../../types/user';
import { queryKeys } from '../../utils/queryKeys';
import { getUserTitle } from '../../utils/userTitle';
import { getErrorMessage } from '../../utils/showError';
import { haptics } from '../../utils/haptics';
import { useFollowCounts } from '../../hooks/useFollows';
import { UpdateCheckButton } from './UpdateCheckButton';

// Same limits as the API
const NAME_MAX = 100;
const BIO_MAX = 500;
const CONTACT_MAX = 200;

interface ProfileCardProps {
  profile: UserProfile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const queryClient = useQueryClient();
  const { data: followCounts } = useFollowCounts(profile.id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editContact, setEditContact] = useState('');

  const avatarMutation = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const { fileName, mimeType } = describeImageUpload(asset);
      return mediaService.uploadAvatar(asset.uri, fileName, mimeType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
    },
    onError: (err) => {
      Alert.alert('Upload failed', getUploadErrorMessage(err));
    },
  });

  const profileMutation = useMutation({
    mutationFn: (data: { full_name?: string; bio?: string; contact_info?: string | null }) =>
      usersService.updateProfile(data),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
      setEditing(false);
    },
    onError: (err) => {
      Alert.alert('Error', getErrorMessage(err, 'Failed to update profile'));
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
      avatarMutation.mutate(result.assets[0]);
    }
  };

  const startEditing = () => {
    setEditName(profile.full_name || '');
    setEditBio(profile.bio || '');
    setEditContact(profile.contact_info || '');
    setEditing(true);
  };

  const saveProfile = () => {
    // Empty strings (not undefined, which the API ignores) so a name or bio can be removed
    profileMutation.mutate({
      full_name: editName.trim(),
      bio: editBio.trim(),
      contact_info: editContact.trim() || null,
    });
  };

  const total = profile.stats?.total ?? 0;
  const title = getUserTitle(total);

  const stat = (value: number | undefined, label: string, onPress?: () => void) => (
    <TouchableOpacity
      style={styles.stat}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.6}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${value ?? 0} ${label}`}
    >
      <Text style={styles.statValue}>{value ?? '–'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.profileCard}>
      {/* Photo on the left, counts beside it */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={pickAvatar} disabled={avatarMutation.isPending} accessibilityLabel="Change profile photo" accessibilityRole="button">
          {/* The API versions the avatar URL (?v=n), so it can be cached like any image */}
          <Avatar
            uri={profile.avatar_url}
            name={profile.full_name || profile.username}
            size={84}
          />
          <View style={styles.editBadge}>
            <Icon
              name={avatarMutation.isPending ? 'hourglass-outline' : 'camera'}
              size={13}
              color="#fff"
            />
          </View>
        </TouchableOpacity>
        <View style={styles.stats}>
          {stat(total, total === 1 ? 'Trail' : 'Trails')}
          {stat(followCounts?.followers_count, 'Followers', () =>
            router.push(`/trail/user/followers?userId=${profile.id}&tab=followers`),
          )}
          {stat(followCounts?.following_count, 'Following', () =>
            router.push(`/trail/user/followers?userId=${profile.id}&tab=following`),
          )}
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={styles.displayName} numberOfLines={1}>
          {profile.full_name || profile.username}
        </Text>
        <View style={styles.metaRow}>
          {profile.full_name ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          <View style={styles.titlePill}>
            <Text style={styles.titleText}>{title.emoji} {title.label}</Text>
          </View>
        </View>
        {!editing && (
          <Text style={[styles.bio, !profile.bio && styles.bioEmpty]}>
            {profile.bio || 'No bio yet. Tap Edit profile to add one.'}
          </Text>
        )}
        {!editing && profile.contact_info ? (
          <View style={styles.contactRow}>
            <Icon name="call-outline" size={14} color={Colors.primary} />
            <Text style={styles.contactText}>{profile.contact_info}</Text>
          </View>
        ) : null}
      </View>

      {editing ? (
        <View style={styles.editForm}>
          <TextInput
            style={styles.editInput}
            placeholder="Full name"
            placeholderTextColor={Colors.textLight}
            value={editName}
            onChangeText={setEditName}
            maxLength={NAME_MAX}
            accessibilityLabel="Full name"
          />
          <TextInput
            style={[styles.editInput, styles.editBioInput]}
            placeholder="Write something about yourself..."
            placeholderTextColor={Colors.textLight}
            value={editBio}
            onChangeText={setEditBio}
            multiline
            numberOfLines={3}
            maxLength={BIO_MAX}
            accessibilityLabel="Bio"
          />
          <TextInput
            style={styles.editInput}
            placeholder="Contact info (phone, Telegram, WhatsApp...)"
            placeholderTextColor={Colors.textLight}
            value={editContact}
            onChangeText={setEditContact}
            maxLength={CONTACT_MAX}
            accessibilityLabel="Contact info"
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
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={startEditing}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Icon name="create-outline" size={17} color={Colors.text} />
            <Text style={styles.editProfileText}>Edit profile</Text>
          </TouchableOpacity>
          {/* TEMPORARY: manual over-the-air update check for testing */}
          <UpdateCheckButton />
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  profileCard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  identity: {
    gap: 4,
  },
  displayName: {
    fontSize: 21,
    fontWeight: '800',
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  handle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  titlePill: {
    backgroundColor: Colors.accent + '20',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
    marginTop: 2,
  },
  bioEmpty: {
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  contactText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editProfileButton: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  editForm: {
    width: '100%',
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
});
