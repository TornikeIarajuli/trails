import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyBadges } from '../../hooks/useBadges';
import { BadgeCard } from '../badges/BadgeCard';

/** The own profile's Badges tab: earned badges in a grid, and the way to every badge. */
export function BadgesSection() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: myBadges, isLoading } = useMyBadges();

  if (isLoading && !myBadges) return null;

  const seeAll = (
    <TouchableOpacity
      style={styles.seeAll}
      onPress={() => router.push('/(tabs)/profile/badges')}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Text style={styles.seeAllText}>See all badges and how to earn them</Text>
      <Icon name="chevron-forward" size={16} color={Colors.primary} />
    </TouchableOpacity>
  );

  if (!myBadges || myBadges.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="ribbon-outline" size={28} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>No badges yet</Text>
        <Text style={styles.emptyText}>Your first badge comes with your first completed trail.</Text>
        {seeAll}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        {myBadges.map((ub) => (
          <View key={ub.id} style={styles.cell}>
            <BadgeCard badge={ub.badges} earned compact />
          </View>
        ))}
      </View>
      {seeAll}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: 16,
      gap: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 14,
    },
    cell: {
      width: '33.33%',
      alignItems: 'center',
    },
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
    },
    seeAllText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    empty: {
      marginHorizontal: 16,
      padding: 24,
      gap: 8,
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
  });
