import React, { useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useLeaderboard } from '../../../hooks/useLeaderboard';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { LeaderboardRow } from '../../../components/leaderboard/LeaderboardRow';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LeaderboardRowSkeleton } from '../../../components/ui/Skeleton';

export default function LeaderboardScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { data, isLoading, isError, error, refetch, isRefetching } = useLeaderboard(50);
  const entries = useWithoutBlocked(data, (entry) => entry.id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Hikers with the most verified trail completions</Text>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 8 }).map((_, i) => <LeaderboardRowSkeleton key={i} />)}
        </View>
      ) : isError && entries.length === 0 ? (
        <ErrorState
          error={error}
          title="Couldn't load the leaderboard"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LeaderboardRow entry={item} isTopThree={item.rank <= 3} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={15}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No completed hikes yet</Text>
              <Text style={styles.emptyHint}>
                Finish a trail with GPS tracking on and you'll be the first name here.
              </Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.push('/(tabs)/home' as any)}
                accessibilityRole="button"
              >
                <Text style={styles.emptyActionText}>Browse trails</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  list: {
    paddingBottom: 20,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyAction: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
