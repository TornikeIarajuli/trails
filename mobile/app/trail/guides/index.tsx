import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { ErrorState } from '../../../components/ui/ErrorState';
import { GuideCard } from '../../../components/guides/GuideCard';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useGuides } from '../../../hooks/useGuides';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { GUIDE_REGIONS } from '../../../utils/guides';
import { withBottomInset } from '../../../utils/insets';
import { haptics } from '../../../utils/haptics';

/**
 * Local guides: verified by the team, by region, or for one trail (`?trailId=`, from the trail
 * page: guides listed on it or guiding in its region).
 */
export default function GuidesScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ trailId?: string; trailName?: string; region?: string }>();
  const trailId = typeof params.trailId === 'string' && params.trailId ? params.trailId : undefined;
  const [region, setRegion] = useState<string | undefined>(
    typeof params.region === 'string' && params.region ? params.region : undefined,
  );

  const query = useGuides(trailId ? { trailId } : { region });
  const guides = useWithoutBlocked(query.data, (g) => g.user_id);

  const header = (
    <View style={styles.header}>
      <Text style={styles.intro}>
        {trailId
          ? `Guides for ${params.trailName ?? 'this trail'}: they know it or work in its region.`
          : 'Local guides, checked by the Kvali team. Send a request; once a guide accepts, you get their phone and settle the details directly.'}
      </Text>
      {!trailId ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regions}>
          {[undefined, ...GUIDE_REGIONS].map((r) => {
            const active = r === region;
            return (
              <TouchableOpacity
                key={r ?? 'all'}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  haptics.select();
                  setRegion(r);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`guides-region-${r ?? 'all'}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r ?? 'All regions'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Local guides',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      {query.isLoading ? (
        <>
          {header}
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
        </>
      ) : query.isError && guides.length === 0 ? (
        <>
          {header}
          <ErrorState error={query.error} title="Couldn't load the guides" onRetry={() => query.refetch()} retrying={query.isRefetching} />
        </>
      ) : (
        <FlatList
          data={guides}
          keyExtractor={(g) => g.user_id}
          renderItem={({ item }) => <GuideCard guide={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={header}
          contentContainerStyle={withBottomInset(styles.list, insets.bottom)}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="people-outline" size={40} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No guides here yet</Text>
              <Text style={styles.emptyText}>
                {region || trailId ? 'Try all regions, or come back soon: guides are joining.' : 'Guides are joining: come back soon.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity
              style={styles.becomeRow}
              onPress={() => router.push('/trail/guides/apply' as never)}
              accessibilityRole="button"
              testID="become-guide"
            >
              <Icon name="ribbon-outline" size={18} color={Colors.primary} />
              <Text style={styles.becomeText}>Are you a guide? List yourself on Kvali</Text>
              <Icon name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      paddingTop: 8,
      paddingBottom: 12,
      gap: 12,
    },
    intro: {
      paddingHorizontal: 16,
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    regions: {
      gap: 8,
      paddingHorizontal: 16,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
    },
    list: {
      paddingBottom: 16,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingTop: 48,
      paddingHorizontal: 32,
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
    becomeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 20,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    becomeText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
  });
