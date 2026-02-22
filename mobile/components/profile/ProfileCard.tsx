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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors, ColorPalette } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';
import { usersService } from '../../services/users';
import { mediaService } from '../../services/media';
import { UserProfile } from '../../types/user';
import { queryKeys } from '../../utils/queryKeys';

interface ProfileCardProps {
  profile: UserProfile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  const avatarMutation = useMutation({
    mutationFn: async (uri: string) => {
      const fileName = uri.split('/').pop() || 'avatar.jpg';
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      return mediaService.uploadAvatar(uri, fileName, mimeType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to upload avatar');
    },
  });

  const profileMutation = useMutation({
    mutationFn: (data: { full_name?: string; bio?: string }) =>
      usersService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
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
    setEditName(profile.full_name || '');
    setEditBio(profile.bio || '');
    setEditing(true);
  };

  const saveProfile = () => {
    profileMutation.mutate({
      full_name: editName.trim() || undefined,
      bio: editBio.trim() || undefined,
    });
  };

  return (
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
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
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
});
