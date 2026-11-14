import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { Avatar } from '../../../components/ui/Avatar';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useMarkAllRead } from '../../../hooks/useNotifications';
import { useNotificationFeed } from '../../../hooks/useNotificationCenter';
import { useIsFollowing, useToggleFollow } from '../../../hooks/useFollows';
import { useAuthStore } from '../../../store/authStore';
import { AppNotification } from '../../../services/notifications';
import { ErrorState } from '../../../components/ui/ErrorState';
import { NotificationRowSkeleton } from '../../../components/ui/Skeleton';
import { BADGE_CATEGORY_COLOR, BADGE_ICON_MAP } from '../../../components/badges/badgeConstants';
import { haptics } from '../../../utils/haptics';
import { getNotificationTarget, mapLinks } from '../../../utils/notificationTarget';
import { groupNotifications, shortTimeAgo, splitActorName } from '../../../utils/notificationGroups';

/** The small badge on the person's photo, saying what happened. */
const TYPE_MARK: Record<string, { icon: IconName; color: string }> = {
  badge_earned: { icon: 'medal', color: '#D97706' },
  completion_approved: { icon: 'checkmark-circle', color: '#16A34A' },
  new_follower: { icon: 'person-add', color: '#2563EB' },
  new_comment: { icon: 'chatbubble', color: '#0284C7' },
  // The feed's like red
  new_like: { icon: 'heart', color: '#E53935' },
  event_invite: { icon: 'calendar', color: '#7C3AED' },
  event_update: { icon: 'calendar', color: '#7C3AED' },
  emergency_contact: { icon: 'shield-checkmark', color: '#DC2626' },
  sos: { icon: 'alert-circle', color: '#DC2626' },
  general: { icon: 'notifications', color: '#64748B' },
};

/** Types whose title is a generic label ("Hike approved"); their body says it all. */
const BODY_ONLY_TYPES = new Set(['badge_earned', 'completion_approved']);

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
    router.push(target.href as never);
    return;
  }

  if (target.kind === 'sos') {
    const { lat, lng, userId } = target;
    const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [];
    if (lat !== null && lng !== null) {
      buttons.push({ text: 'Open location in Maps', onPress: () => openInMaps(lat, lng) });
    }
    if (userId) {
      buttons.push({ text: 'View profile', onPress: () => router.push(`/trail/user/${userId}` as never) });
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

function FollowBackButton({ userId, styles }: { userId: string; styles: ReturnType<typeof createStyles> }) {
  const { data: following } = useIsFollowing(userId);
  const toggle = useToggleFollow();
  if (!following) return null;
  const isFollowing = following.following === true;
  return (
    <TouchableOpacity
      style={[styles.followButton, isFollowing && styles.followingButton]}
      onPress={() => {
        haptics.tap();
        toggle.mutate(userId);
      }}
      disabled={toggle.isPending}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Following. Tap to unfollow' : 'Follow back'}
    >
      <Text style={[styles.followText, isFollowing && styles.followingText]}>{isFollowing ? 'Following' : 'Follow back'}</Text>
    </TouchableOpacity>
  );
}

function NotificationItem({
  item,
  fresh,
  onPress,
  styles,
  Colors,
}: {
  item: AppNotification;
  fresh: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const mark = TYPE_MARK[item.type] ?? TYPE_MARK.general;
  const actorSplit = item.actor ? splitActorName(item.body ?? '', item.actor.username) : null;
  const time = shortTimeAgo(item.created_at);

  // Left: the badge itself, the person's photo with what happened, or the type's icon
  let leading: React.ReactNode;
  if (item.type === 'badge_earned' && item.badge) {
    const color = BADGE_CATEGORY_COLOR[item.badge.category as keyof typeof BADGE_CATEGORY_COLOR] ?? mark.color;
    leading = (
      <View style={[styles.leadingCircle, { backgroundColor: color }]}>
        <Icon name={(BADGE_ICON_MAP[item.badge.icon] ?? 'ribbon') as IconName} size={22} color="#FFFFFF" />
      </View>
    );
  } else if (item.actor) {
    leading = (
      <View>
        <Avatar uri={item.actor.avatar_url} name={item.actor.username} size={48} />
        <View style={[styles.typeMark, { backgroundColor: mark.color }]}>
          <Icon name={mark.icon} size={11} color="#FFFFFF" />
        </View>
      </View>
    );
  } else {
    leading = (
      <View style={[styles.leadingCircle, { backgroundColor: mark.color + '1F' }]}>
        <Icon name={mark.icon} size={22} color={mark.color} />
      </View>
    );
  }

  // Middle: one sentence with the person in bold, or the title and what it says
  let message: React.ReactNode;
  if (actorSplit) {
    message = (
      <>
        <Text style={styles.bold}>{actorSplit.name}</Text>
        {actorSplit.rest}
      </>
    );
  } else if (BODY_ONLY_TYPES.has(item.type) && item.body) {
    message = item.body;
  } else {
    message = (
      <>
        <Text style={styles.bold}>{item.title}</Text>
        {item.body ? ` ${item.body}` : ''}
      </>
    );
  }

  // Right: follow back for new followers, otherwise the trail's photo
  let trailing: React.ReactNode = null;
  if (item.type === 'new_follower' && item.actor) {
    trailing = <FollowBackButton userId={item.actor.id} styles={styles} />;
  } else if (item.trail?.cover_image_url) {
    trailing = <Image source={{ uri: item.trail.cover_image_url }} style={styles.thumb} cachePolicy="memory-disk" transition={150} />;
  }

  return (
    <TouchableOpacity
      style={[styles.row, fresh && styles.rowFresh]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${fresh ? 'New. ' : ''}${item.title}. ${item.body}. ${time}`}
    >
      {leading}
      <Text style={styles.message} numberOfLines={3}>
        {message}
        <Text style={styles.time}>{time ? `  ${time}` : ''}</Text>
      </Text>
      {trailing}
    </TouchableOpacity>
  );
}

function SignedOut({ styles, Colors }: { styles: ReturnType<typeof createStyles>; Colors: ColorPalette }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="notifications-outline" size={40} color={Colors.textLight} />
      </View>
      <Text style={styles.emptyTitle}>Log in to see your alerts</Text>
      <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/(auth)/login')} accessibilityRole="button">
        <Text style={styles.loginButtonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AlertsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading, isError, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotificationFeed(isAuthenticated);
  const markAllRead = useMarkAllRead();

  const notifications = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flatMap((page) => page.data ?? []) ?? []).filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  }, [data]);
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  // Opening the screen marks everything read, like Instagram: what was new stays highlighted
  // under "New" for this visit, and the tab's badge clears.
  const [visit, setVisit] = useState(0);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set());
  const handledVisit = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      let active = true;
      refetch().finally(() => {
        if (active) setVisit((v) => v + 1);
      });
      return () => {
        active = false;
      };
    }, [isAuthenticated, refetch]),
  );
  const markAll = markAllRead.mutate;
  useEffect(() => {
    if (visit === 0 || handledVisit.current === visit || !data) return;
    handledVisit.current = visit;
    const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);
    setFreshIds(new Set(unread));
    if (unread.length > 0 || unreadCount > 0) markAll();
  }, [visit, data, notifications, unreadCount, markAll]);

  const sections = useMemo(() => groupNotifications(notifications, freshIds), [notifications, freshIds]);

  const handlePress = (item: AppNotification) => {
    haptics.tap();
    openNotification(item);
  };

  let content: React.ReactNode;
  if (!isAuthenticated) {
    content = <SignedOut styles={styles} Colors={Colors} />;
  } else if (isLoading) {
    content = (
      <View>
        {Array.from({ length: 7 }).map((_, i) => (
          <NotificationRowSkeleton key={i} />
        ))}
      </View>
    );
  } else if (isError && notifications.length === 0) {
    content = <ErrorState error={error} title="Couldn't load notifications" onRetry={() => refetch()} retrying={isRefetching} />;
  } else {
    content = (
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            fresh={freshIds.has(item.id) || !item.read_at}
            styles={styles}
            Colors={Colors}
            onPress={() => handlePress(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
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
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footerSpinner} color={Colors.primary} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="notifications-outline" size={40} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptySubtitle}>New followers, likes, comments, badges and group hikes show up here.</Text>
          </View>
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Notifications</Text>
        {isAuthenticated && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/alerts/preferences')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Notification settings"
          >
            <Icon name="settings-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.list}>{content}</View>
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
      paddingBottom: 4,
    },
    screenTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: Colors.text,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.text,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 6,
      backgroundColor: Colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    rowFresh: {
      backgroundColor: Colors.primary + '14',
    },
    leadingCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeMark: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: Colors.background,
    },
    message: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: Colors.text,
    },
    bold: {
      fontWeight: '700',
    },
    time: {
      fontSize: 13,
      color: Colors.textLight,
    },
    thumb: {
      width: 46,
      height: 46,
      borderRadius: 8,
      backgroundColor: Colors.borderLight,
    },
    followButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: Colors.primary,
    },
    followingButton: {
      backgroundColor: Colors.borderLight,
    },
    followText: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    followingText: {
      color: Colors.text,
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
      paddingHorizontal: 32,
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
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
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
  });
