import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useUpcomingEvents } from '../../hooks/useEvents';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { useAuthStore } from '../../store/authStore';
import { GroupHikeCard } from './GroupHikeCard';
import { haptics } from '../../utils/haptics';

/** Explore's "Group hikes" row: the next few hikes anyone can join, and the way to all of them. */
export function GroupHikesStrip() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const { data } = useUpcomingEvents();
  const events = useWithoutBlocked(data, (e) => e.organizer_id);

  if (events.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Group hikes</Text>
        <TouchableOpacity
          style={styles.seeAll}
          onPress={() => {
            haptics.tap();
            router.push('/trail/group-hikes' as never);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`See all ${events.length} group hikes`}
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Icon name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={events.slice(0, 8)}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <GroupHikeCard event={item} userId={userId} variant="card" />}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        contentContainerStyle={styles.row}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      gap: 10,
      marginBottom: 16,
    },
    header: {
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
    },
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    row: {
      paddingHorizontal: 16,
    },
  });
