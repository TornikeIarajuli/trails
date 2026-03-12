import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useAuthStore } from '../../../store/authStore';
import { usersService } from '../../../services/users';
import { queryKeys } from '../../../utils/queryKeys';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { StatsGrid } from '../../../components/profile/StatsGrid';
import { ProfileCard } from '../../../components/profile/ProfileCard';
import { FollowCountsRow } from '../../../components/profile/FollowCountsRow';
import { BadgesSection } from '../../../components/profile/BadgesSection';
import { CompletionsSection } from '../../../components/profile/CompletionsSection';

const NAV_ITEMS = [
  { key: 'bookmarks', icon: 'bookmark-outline', label: 'Bookmarks', route: '/(tabs)/profile/bookmarks' },
  { key: 'recommendations', icon: 'compass-outline', label: 'For You', route: '/(tabs)/profile/recommendations' },
  { key: 'analytics', icon: 'bar-chart-outline', label: 'Analytics', route: '/(tabs)/profile/analytics' },
  { key: 'settings', icon: 'settings-outline', label: 'Settings', route: '/(tabs)/profile/settings' },
] as const;

export default function ProfileScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => usersService.getMyProfile(),
    enabled: isAuthenticated,
  });

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

  if (isLoading) return <LoadingSpinner />;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {profile && (
        <>
          <ProfileCard profile={profile} />
          <FollowCountsRow userId={profile.id} />
          <StatsGrid stats={profile.stats} />

          {/* Navigation cards */}
          <View style={styles.navGrid}>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.navCard}
                activeOpacity={0.7}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon as any} size={22} color={Colors.primary} />
                <Text style={styles.navLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <BadgesSection />
          <CompletionsSection />
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
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  navCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
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
