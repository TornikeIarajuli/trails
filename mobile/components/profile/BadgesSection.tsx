import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { useMyBadges } from '../../hooks/useBadges';
import { BadgeCard } from '../badges/BadgeCard';

export function BadgesSection() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: myBadges } = useMyBadges();

  if (!myBadges || myBadges.length === 0) return null;

  return (
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
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
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
