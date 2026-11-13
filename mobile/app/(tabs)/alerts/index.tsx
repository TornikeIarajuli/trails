import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useMarkRead, useMarkAllRead } from '../../../hooks/useNotifications';
import { useNotificationFeed } from '../../../hooks/useNotificationCenter';
import { useAuthStore } from '../../../store/authStore';
import { AppNotification } from '../../../services/notifications';
import { ErrorState } from '../../../components/ui/ErrorState';
import { NotificationRowSkeleton } from '../../../components/ui/Skeleton';
import { haptics } from '../../../utils/haptics';
import { getNotificationTarget, mapLinks } from '../../../utils/notificationTarget';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  badge_earned:        { icon: 'medal',              color: '#F59E0B', bg: '#FEF3C7' },
  completion_approved: { icon: 'checkmark-circle',   color: '#16A34A', bg: '#DCFCE7' },
  new_follower:        { icon: 'person-add',          color: '#3B82F6', bg: '#DBEAFE' },
  new_comment:         { icon: 'chatbubble',          color: '#0EA5E9', bg: '#E0F2FE' },
  event_invite:        { icon: 'calendar',            color: '#8B5CF6', bg: '#EDE9FE' },
  event_update:        { icon: 'calendar',            color: '#8B5CF6', bg: '#EDE9FE' },
  emergency_contact:   { icon: 'shield-checkmark',    color: '#DC2626', bg: '#FEE2E2' },
  sos:                 { icon: 'alert-circle',        color: '#DC2626', bg: '#FEE2E2' },
  general:             { icon: 'notifications',       color: '#6B7280', bg: '#F3F4F6' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

async function openInMaps(lat: number, lng: number) {
  for (const url of mapLinks(lat, lng, Platform.OS)) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try the next link
    }
  }
  Alert.alert('Could not open maps', `The location is ${lat.toFixed(5)}, ${lng.toFixed(5)}.`);
}

/**
 * Opens what the notification is about on top of this list, so Back returns here:
 * trail, event, profile and completion screens are pushed on the root stack, and
 * the badges screen is part of this tab's stack. It never switches tabs.
 */
function openNotification(item: AppNotification) {
  const target = getNotificationTarget(item.type, item.data);

  if (target.kind === 'route') {
    router.push(target.href as any);
    return;
  }

  if (target.kind === 'sos') {
    const { lat, lng, userId } = target;
    const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [];
    if (lat !== null && lng !== null) {
      buttons.push({ text: 'Open location in Maps', onPress: () => openInMaps(lat, lng) });
    }
    if (userId) {
      buttons.push({ text: 'View profile', onPress: () => router.push(`/trail/user/${userId}` as any) });
    }
    buttons.push({ text: 'Close', style: 'cancel' });
    Alert.alert(
      item.title || 'SOS',
      lat !== null && lng !== null
        ? `${item.body}\n\nLocation: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n\nIf they may be in danger, call 112.`
        : `${item.body}\n\nIf they may be in danger, call 112.`,
      buttons,
    );
  }
}

function NotificationRow({
  item,
  onPress,
  styles,
  Colors,
}: {
  item: AppNotification;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.general;
  const isUnread = !item.read_at;
  const actionable = getNotificationTarget(item.type, item.data).kind !== 'none';

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && { backgroundColor: Colors.primary + '08' }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${item.title}. ${item.body}`}
    >
      {isUnread && <View style={styles.unreadBar} />}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
      </View>
      {actionable && <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />}
    </TouchableOpacity>
  );
}

function SignedOut({ styles, Colors }: { styles: ReturnType<typeof createStyles>; Colors: ColorPalette }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-outline" size={40} color={Colors.textLight} />
      </View>
      <Text style={styles.emptyTitle}>Log in to see your alerts</Text>
      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => router.push('/(auth)/login')}
        accessibilityRole="button"
      >
        <Text style={styles.loginButtonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AlertsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationFeed(isAuthenticated);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flatMap((page) => page.data ?? []) ?? []).filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  }, [data]);
  // The first page carries the user's total unread count
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  const handlePress = (item: AppNotification) => {
    if (!item.read_at) markRead.mutate(item.id);
    haptics.tap();
    openNotification(item);
  };

  let content: React.ReactNode;
  if (!isAuthenticated) {
    content = <SignedOut styles={styles} Colors={Colors} />;
  } else if (isLoading) {
    content = (
      <View>
        {Array.from({ length: 6 }).map((_, i) => (
          <NotificationRowSkeleton key={i} />
        ))}
      </View>
    );
  } else if (isError && notifications.length === 0) {
    content = (
      <ErrorState
        error={error}
        title="Couldn't load notifications"
        onRetry={() => refetch()}
        retrying={isRefetching}
      />
    );
  } else {
    content = (
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            styles={styles}
            Colors={Colors}
            onPress={() => handlePress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerSpinner} color={Colors.primary} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySubtitle}>No notifications yet</Text>
          </View>
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Notifications</Text>
        {isAuthenticated && unreadCount > 0 && (
          <TouchableOpacity
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Mark all ${unreadCount} as read`}
          >
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.list}>{content}</View>

      {isAuthenticated && (
        <TouchableOpacity
          style={styles.prefsLink}
          onPress={() => router.push('/(tabs)/alerts/preferences')}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Ionicons name="options-outline" size={18} color={Colors.primary} />
          <Text style={styles.prefsLinkText}>Manage Preferences</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
        </TouchableOpacity>
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    screenTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: Colors.text,
    },
    markAll: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.accent,
    },
    list: {
      flex: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: Colors.surface,
    },
    unreadBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: Colors.primary,
      borderRadius: 2,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowContent: {
      flex: 1,
      gap: 4,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: {
      fontSize: 14,
      color: Colors.text,
      fontWeight: '500',
      flex: 1,
    },
    titleUnread: {
      fontWeight: '700',
    },
    body: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    time: {
      fontSize: 11,
      color: Colors.textLight,
      flexShrink: 0,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginLeft: 72,
    },
    footerSpinner: {
      paddingVertical: 16,
    },
    emptyContainer: {
      flexGrow: 1,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 60,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    loginButton: {
      marginTop: 8,
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
    prefsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    prefsLinkText: {
      flex: 1,
      fontSize: 15,
      color: Colors.primary,
      fontWeight: '500',
    },
  });
