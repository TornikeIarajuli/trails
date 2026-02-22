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
import { BookmarksSection } from '../../../components/profile/BookmarksSection';

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
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile/settings')}>
          <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {profile && (
        <>
          <ProfileCard profile={profile} />
          <FollowCountsRow userId={profile.id} />
          <StatsGrid stats={profile.stats} />
          <BadgesSection />
          <CompletionsSection />
          <BookmarksSection />
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
