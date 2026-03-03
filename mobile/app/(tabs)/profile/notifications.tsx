import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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

const TYPE_ICON: Record<string, { name: string; color: string }> = {
  badge_earned:        { name: 'medal',               color: '#F59E0B' },
  completion_approved: { name: 'checkmark-circle',    color: '#16A34A' },
  new_follower:        { name: 'person-add',           color: '#3B82F6' },
  event_invite:        { name: 'calendar',             color: '#8B5CF6' },
  trail_condition:     { name: 'warning',              color: '#D97706' },
  general:             { name: 'notifications',        color: '#6B7280' },
};

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
  const icon = TYPE_ICON[item.type] ?? TYPE_ICON.general;
  const isUnread = !item.read_at;

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: icon.color + '20' }]}>
        <Ionicons name={icon.name as any} size={20} color={icon.color} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      {isUnread && <View style={styles.dot} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { data, isLoading } = useNotificationList(1);
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
              >
                <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 14 }}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <View style={styles.container}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
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
          />
        )}

        <TouchableOpacity
          style={styles.prefsLink}
          onPress={() => router.push('/(tabs)/profile/notification-preferences')}
        >
          <Ionicons name="settings-outline" size={18} color={Colors.primary} />
          <Text style={styles.prefsLinkText}>Notification Preferences</Text>
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
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: Colors.surface,
    },
    rowUnread: {
      backgroundColor: Colors.card,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 14,
      color: Colors.text,
      fontWeight: '500',
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
      marginTop: 2,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.primary,
      marginTop: 6,
    },
    separator: {
      height: 1,
      backgroundColor: Colors.borderLight,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyText: {
      fontSize: 16,
      color: Colors.textLight,
    },
    prefsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
    prefsLinkText: {
      flex: 1,
      fontSize: 15,
      color: Colors.primary,
      fontWeight: '500',
    },
  });
