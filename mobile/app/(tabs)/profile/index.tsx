import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../../components/ui/Icon';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useAuthStore } from '../../../store/authStore';
import { usersService } from '../../../services/users';
import { queryKeys } from '../../../utils/queryKeys';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ProfileCard } from '../../../components/profile/ProfileCard';
import { HikingSummary } from '../../../components/profile/HikingSummary';
import { BadgesSection } from '../../../components/profile/BadgesSection';
import { CompletionsSection } from '../../../components/profile/CompletionsSection';
import { useMyCompletions } from '../../../hooks/useCompletions';
import { useMyBadges } from '../../../hooks/useBadges';
import { haptics } from '../../../utils/haptics';

const QUICK_LINKS = [
  { key: 'bookmarks', icon: 'bookmark-outline', label: 'Bookmarks', route: '/(tabs)/profile/bookmarks' },
  { key: 'recommendations', icon: 'compass-outline', label: 'For You', route: '/(tabs)/profile/recommendations' },
  { key: 'analytics', icon: 'bar-chart-outline', label: 'Analytics', route: '/(tabs)/profile/analytics' },
] as const;

type ProfileTab = 'hikes' | 'badges';

/**
 * The own profile, top to bottom: who you are (header with counts and actions), how you hike
 * (one summary card), shortcuts, then your hikes or your badges, one at a time.
 */
export default function ProfileScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState<ProfileTab>('hikes');

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => usersService.getMyProfile(),
    enabled: isAuthenticated,
  });
  const completions = useMyCompletions({ enabled: isAuthenticated });
  const badges = useMyBadges();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), completions.refetch(), badges.refetch()]);
    setRefreshing(false);
  }, [refetch, completions, badges]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loginPrompt}>Log in to see your profile</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  const hikeCount = completions.data?.length;
  const badgeCount = badges.data?.length;
  const tabs: { key: ProfileTab; label: string; count?: number }[] = [
    { key: 'hikes', label: 'Hikes', count: hikeCount },
    { key: 'badges', label: 'Badges', count: badgeCount },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
    >
      {profile && (
        <>
          <ProfileCard profile={profile} />

          {profile.stats && <HikingSummary stats={profile.stats} />}

          <View style={styles.links}>
            {QUICK_LINKS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.link}
                activeOpacity={0.7}
                onPress={() => {
                  haptics.tap();
                  router.push(item.route as never);
                }}
                accessibilityRole="button"
              >
                <View style={styles.linkIcon}>
                  <Icon name={item.icon} size={20} color={Colors.primary} />
                </View>
                <Text style={styles.linkLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.segment} accessibilityRole="tablist">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => {
                    if (!active) haptics.select();
                    setTab(t.key);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t.label}
                    {typeof t.count === 'number' ? ` · ${t.count}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === 'hikes' ? <CompletionsSection /> : <BadgesSection />}
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      gap: 16,
      paddingBottom: 32,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    links: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
    },
    link: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    linkIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '15',
    },
    linkLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.text,
    },
    segment: {
      flexDirection: 'row',
      marginHorizontal: 16,
      padding: 4,
      borderRadius: 12,
      backgroundColor: Colors.borderLight,
    },
    segmentButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 9,
    },
    segmentButtonActive: {
      backgroundColor: Colors.surface,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    segmentTextActive: {
      color: Colors.text,
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
  });
