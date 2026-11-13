import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useFollowList } from '../../../hooks/useFollows';
import { FollowRow } from '../../../types/follow';

type Tab = 'followers' | 'following';

function UserRow({ user, styles }: { user: FollowRow; styles: any }) {
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

  const followers = useFollowList('followers', userId);
  const following = useFollowList('following', userId);
  const active = activeTab === 'followers' ? followers : following;

  const rows = useMemo(() => {
    const seen = new Set<string>();
    return (active.data?.pages.flatMap((page) => page.data) ?? []).filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [active.data]);

  const followersTotal = followers.data?.pages[0]?.pagination.total;
  const followingTotal = following.data?.pages[0]?.pagination.total;

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
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'followers' }}
          >
            <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
              Followers{followersTotal != null ? ` (${followersTotal})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'following' && styles.tabActive]}
            onPress={() => setActiveTab('following')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'following' }}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
              Following{followingTotal != null ? ` (${followingTotal})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {active.isLoading ? (
          <LoadingSpinner />
        ) : active.isError && rows.length === 0 ? (
          <ErrorState
            error={active.error}
            onRetry={() => active.refetch()}
            retrying={active.isRefetching}
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <UserRow user={item} styles={styles} />}
            contentContainerStyle={styles.list}
            onEndReached={() => {
              if (active.hasNextPage && !active.isFetchingNextPage) active.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={active.isRefetching && !active.isFetchingNextPage}
                onRefresh={() => active.refetch()}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            ListFooterComponent={
              active.isFetchingNextPage ? (
                <ActivityIndicator style={styles.footer} color={Colors.primary} />
              ) : null
            }
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
  footer: {
    paddingVertical: 16,
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
