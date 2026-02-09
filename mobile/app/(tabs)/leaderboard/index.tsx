import React from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { useLeaderboard } from '../../../hooks/useLeaderboard';
import { LeaderboardRow } from '../../../components/leaderboard/LeaderboardRow';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

export default function LeaderboardScreen() {
  const { data, isLoading } = useLeaderboard(50);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top trail conquerors</Text>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LeaderboardRow entry={item} isTopThree={item.rank <= 3} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No hikers yet. Be the first!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
  },
});
