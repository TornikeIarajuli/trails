import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  RefreshControl,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { useTrails, useRegions } from '../../../hooks/useTrails';
import { useDebounce } from '../../../hooks/useDebounce';
import { TrailCard } from '../../../components/trail/TrailCard';
import { TrailFilters } from '../../../components/trail/TrailFilters';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailDifficulty, Trail } from '../../../types/trail';

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: regions } = useRegions();

  const params = useMemo(
    () => ({
      ...(difficulty && { difficulty }),
      ...(region && { region }),
      ...(debouncedSearch && { search: debouncedSearch }),
      limit: 20,
    }),
    [difficulty, region, debouncedSearch],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useTrails(params);

  const trails = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  return (
    <View style={styles.container}>
      <TrailFilters
        search={search}
        onSearchChange={setSearch}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        region={region}
        onRegionChange={setRegion}
        regions={regions ?? []}
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item: Trail) => item.id}
          renderItem={({ item }) => <TrailCard trail={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No trails found</Text>
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
  list: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
  },
});
