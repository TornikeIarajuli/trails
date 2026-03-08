import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import {
  useNotificationList,
  useMarkRead,
  useMarkAllRead,
} from '../../../hooks/useNotifications';
import { AppNotification } from '../../../services/notifications';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  badge_earned:        { icon: 'medal',              color: '#F59E0B', bg: '#FEF3C7' },
  completion_approved: { icon: 'checkmark-circle',   color: '#16A34A', bg: '#DCFCE7' },
  new_follower:        { icon: 'person-add',          color: '#3B82F6', bg: '#DBEAFE' },
  event_invite:        { icon: 'calendar',            color: '#8B5CF6', bg: '#EDE9FE' },
  trail_condition:     { icon: 'warning',             color: '#D97706', bg: '#FEF3C7' },
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

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && { backgroundColor: Colors.primary + '08' }]}
      onPress={onPress}
      activeOpacity={0.7}
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
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { data, isLoading, refetch, isRefetching } = useNotificationList(1);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
          headerRight: () =>
            unreadCount > 0 ? (
              <TouchableOpacity
                onPress={() => markAllRead.mutate()}
                style={{ marginRight: 16 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: Colors.accent, fontWeight: '600', fontSize: 14 }}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <View style={styles.container}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} size="large" />
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySubtitle}>No notifications yet</Text>
          </View>
        ) : (
          <>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
              </View>
            )}
            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              renderItem={({ item }) => (
                <NotificationRow
                  item={item}
                  styles={styles}
                  Colors={Colors}
                  onPress={() => {
                    if (!item.read_at) markRead.mutate(item.id);
                  }}
                />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  tintColor={Colors.primary}
                  colors={[Colors.primary]}
                />
              }
            />
          </>
        )}

        <TouchableOpacity
          style={styles.prefsLink}
          onPress={() => router.push('/(tabs)/profile/notification-preferences')}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={18} color={Colors.primary} />
          <Text style={styles.prefsLinkText}>Manage Preferences</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    unreadBadge: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      alignSelf: 'flex-start',
      backgroundColor: Colors.primary + '15',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    unreadBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
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
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingBottom: 60,
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
