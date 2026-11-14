import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { Icon } from '../../../components/ui/Icon';
import { useColors, ColorPalette } from '../../../constants/colors';
import { usersService } from '../../../services/users';
import {
  moderationErrorMessage,
  useBlockedUserIds,
  useUnblockUser,
} from '../../../hooks/useModeration';
import { Avatar } from '../../../components/ui/Avatar';
import { queryKeys } from '../../../utils/queryKeys';
import { withBottomInset } from '../../../utils/insets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const blocked = useBlockedUserIds();
  const ids = useMemo(() => Array.from(blocked), [blocked]);
  const unblock = useUnblockUser();

  const profiles = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.follows.publicProfile(id),
      queryFn: () => usersService.getPublicProfile(id),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const confirmUnblock = (id: string, name: string) => {
    Alert.alert(`Unblock ${name}?`, 'Their photos, comments, reviews and activity will be visible to you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () =>
          unblock.mutate(id, {
            onError: (err) => Alert.alert('Error', moderationErrorMessage(err)),
          }),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Blocked users',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <FlatList
        style={styles.container}
        contentContainerStyle={withBottomInset(styles.content, insets.bottom)}
        data={ids}
        keyExtractor={(id) => id}
        renderItem={({ item: id, index }) => {
          const profile = profiles[index]?.data;
          const name = profile?.username ? `@${profile.username}` : 'Unknown user';
          const pending = unblock.isPending && unblock.variables === id;
          return (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.user}
                onPress={() => router.push(`/trail/user/${id}` as any)}
                accessibilityRole="button"
              >
                <Avatar uri={profile?.avatar_url} name={profile?.username} size={40} />
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unblockButton}
                onPress={() => confirmUnblock(id, name)}
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${name}`}
              >
                {pending ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.unblockText}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        ListHeaderComponent={
          <Text style={styles.hint}>
            You don't see content from people you block, and you no longer follow each other.
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="ban-outline" size={40} color={Colors.textLight} />
            <Text style={styles.emptyText}>You haven't blocked anyone</Text>
          </View>
        }
      />
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: 16, flexGrow: 1 },
    hint: { fontSize: 13, lineHeight: 18, color: Colors.textSecondary, marginBottom: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    user: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
    unblockButton: {
      minWidth: 84,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    unblockText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 15, color: Colors.textLight },
  });
