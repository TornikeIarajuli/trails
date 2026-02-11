import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useFollowers, useFollowing } from '../../../hooks/useFollows';
import { FollowUser } from '../../../types/follow';

type Tab = 'followers' | 'following';

function UserRow({ user, styles }: { user: { profiles: FollowUser }; styles: any }) {
  const profile = user.profiles;
  if (!profile) return null;

  return (
    <TouchableOpacity
      style={styles.userRow}
      activeOpacity={0.7}
      onPress={() => router.push(`/trail/user/${profile.id}`)}
    >
      <Avatar
        uri={profile.avatar_url}
        name={profile.full_name || profile.username}
        size={48}
      />
      <View style={styles.userInfo}>
        <Text style={styles.username}>{profile.username}</Text>
        {profile.full_name && (
          <Text style={styles.fullName}>{profile.full_name}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function FollowersScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { userId, tab: initialTab } = useLocalSearchParams<{
    userId: string;
    tab: Tab;
  }>();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'followers');

  const { data: followersData, isLoading: loadingFollowers } = useFollowers(userId);
  const { data: followingData, isLoading: loadingFollowing } = useFollowing(userId);

  const data = activeTab === 'followers' ? followersData : followingData;
  const isLoading = activeTab === 'followers' ? loadingFollowers : loadingFollowing;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'followers' && styles.tabActive]}
            onPress={() => setActiveTab('followers')}
          >
            <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
              Followers{followersData ? ` (${followersData.pagination.total})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'following' && styles.tabActive]}
            onPress={() => setActiveTab('following')}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
              Following{followingData ? ` (${followingData.pagination.total})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            data={data?.data ?? []}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }) => <UserRow user={item} styles={styles} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {activeTab === 'followers'
                    ? 'No followers yet'
                    : 'Not following anyone yet'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  list: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  fullName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textLight,
  },
});
