import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  RefreshControl,
} from 'react-native';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrails, useRegions } from '../../../hooks/useTrails';
import { useDebounce } from '../../../hooks/useDebounce';
import { TrailCard } from '../../../components/trail/TrailCard';
import { TrailFilters } from '../../../components/trail/TrailFilters';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailDifficulty, Trail } from '../../../types/trail';

export default function HomeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

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

  const trails = useMemo(() => {
    const all = data?.pages.flatMap((page) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [data]);

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
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          getItemLayout={(_data, index) => ({
            length: 264,
            offset: 264 * index,
            index,
          })}
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

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
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
