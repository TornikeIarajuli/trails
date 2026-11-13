import React, { useMemo } from 'react';
import { Tabs, usePathname, useSegments, router } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, useReducedMotion, withSpring } from 'react-native-reanimated';
import { useColors, ColorPalette } from '../../constants/colors';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useUnreadNotificationCount } from '../../hooks/useNotificationCenter';
import { haptics } from '../../utils/haptics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: {
  name: string;
  label: string;
  route: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
}[] = [
  { name: 'home', label: 'Explore', route: '/(tabs)/home', icon: 'compass-outline', activeIcon: 'compass' },
  { name: 'feed', label: 'Feed', route: '/(tabs)/feed', icon: 'newspaper-outline', activeIcon: 'newspaper' },
  { name: 'shop', label: 'Shop', route: '/(tabs)/shop', icon: 'bag-outline', activeIcon: 'bag' },
  { name: 'leaderboard', label: 'Ranks', route: '/(tabs)/leaderboard', icon: 'trophy-outline', activeIcon: 'trophy' },
  { name: 'alerts', label: 'Alerts', route: '/(tabs)/alerts', icon: 'notifications-outline', activeIcon: 'notifications' },
  { name: 'profile', label: 'Profile', route: '/(tabs)/profile', icon: 'person-outline', activeIcon: 'person' },
];

function AnimatedTabButton({
  onPress,
  isActive,
  icon,
  activeIcon,
  label,
  badgeCount = 0,
  Colors,
}: {
  onPress: () => void;
  isActive: boolean;
  icon: IoniconsName;
  activeIcon: IoniconsName;
  label: string;
  badgeCount?: number;
  Colors: ColorPalette;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { if (!reducedMotion) scale.value = withSpring(0.88, { damping: 12, stiffness: 300 }); }}
      onPressOut={() => { if (!reducedMotion) scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
      onPress={onPress}
      accessibilityLabel={badgeCount > 0 ? `${label}, ${badgeCount} unread` : label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={{ flex: 1, alignItems: 'center' }}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 2 }, animStyle]}>
        <View>
          <Ionicons
            name={isActive ? activeIcon : icon}
            size={22}
            color={isActive ? Colors.primary : Colors.textSecondary}
          />
          {badgeCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -10,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: Colors.error,
                borderWidth: 1.5,
                borderColor: Colors.surface,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }} maxFontSizeMultiplier={1.3}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{
            fontSize: 10,
            fontWeight: isActive ? '700' : '500',
            color: isActive ? Colors.primary : Colors.textSecondary,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function Header() {
  const insets = useSafeAreaInsets();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const networkQuality = useNetworkStatus();

  const bannerConfig = networkQuality === 'offline'
    ? { icon: 'cloud-offline-outline' as const, text: "You're offline — showing cached data", color: '#C62828' }
    : networkQuality === 'poor'
    ? { icon: 'cellular-outline' as const, text: 'Poor connection', color: '#E65100' }
    : null;

  return (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.appTitle}>Mikiri Trails</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/search')}
            accessibilityLabel="Find hikers"
            accessibilityRole="button"
            style={styles.searchButton}
          >
            <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      {bannerConfig && (
        <View style={[styles.offlineBanner, { backgroundColor: bannerConfig.color }]}>
          <Ionicons name={bannerConfig.icon} size={13} color="#fff" />
          <Text style={styles.offlineText}>{bannerConfig.text}</Text>
        </View>
      )}
    </View>
  );
}

function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const unreadCount = useUnreadNotificationCount();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TAB_CONFIG.map((tab) => {
        const isActive = pathname === '/' ? tab.name === 'home' : pathname.includes(`/${tab.name}`);
        return (
          <AnimatedTabButton
            key={tab.name}
            onPress={() => {
              if (!isActive) haptics.select();
              router.navigate(tab.route as any);
            }}
            isActive={isActive}
            icon={tab.icon}
            activeIcon={tab.activeIcon}
            label={tab.label}
            badgeCount={tab.name === 'alerts' ? unreadCount : 0}
            Colors={Colors}
          />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const segments = useSegments();
  // Hide header + bottom tabs when inside a sub-screen (e.g. settings, trail detail, hike)
  const isSubScreen = segments.length > 2;

  return (
    <View style={styles.container}>
      {!isSubScreen && <Header />}
      <Tabs
        tabBar={() => null}
        // freezeOnBlur: hidden tabs stop re-rendering. Nothing that must keep running lives
        // in a tab screen — the header, tab bar and unread badge render outside the tabs,
        // and hike tracking runs in a background task and its store.
        screenOptions={{ headerShown: false, freezeOnBlur: true }}
        // Android Back on a tab returns to the tab the user came from
        backBehavior="history"
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="shop" />
        <Tabs.Screen name="leaderboard" />
        <Tabs.Screen name="alerts" />
        <Tabs.Screen name="profile" />
      </Tabs>
      {!isSubScreen && <BottomTabBar />}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.warning,
    paddingVertical: 6,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});
