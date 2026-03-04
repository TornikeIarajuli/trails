import React, { useMemo } from 'react';
import { Tabs, usePathname, useSegments, router } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useColors, ColorPalette } from '../../constants/colors';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: { name: string; route: string; icon: IoniconsName; activeIcon: IoniconsName }[] = [
  { name: 'home', route: '/(tabs)/home', icon: 'compass-outline', activeIcon: 'compass' },
  { name: 'feed', route: '/(tabs)/feed', icon: 'newspaper-outline', activeIcon: 'newspaper' },
  { name: 'shop', route: '/(tabs)/shop', icon: 'bag-outline', activeIcon: 'bag' },
  { name: 'leaderboard', route: '/(tabs)/leaderboard', icon: 'trophy-outline', activeIcon: 'trophy' },
  { name: 'profile', route: '/(tabs)/profile', icon: 'person-outline', activeIcon: 'person' },
];

function AnimatedIconButton({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.82, { damping: 12, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
      onPress={onPress}
    >
      <Animated.View style={[style, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function Header() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
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
        <View style={styles.navIcons}>
          <AnimatedIconButton
            style={styles.navIcon}
            onPress={() => router.push('/search')}
          >
            <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
          </AnimatedIconButton>
          {TAB_CONFIG.map((tab) => {
            const isActive = pathname.includes(`/${tab.name}`);
            return (
              <AnimatedIconButton
                key={tab.name}
                onPress={() => router.navigate(tab.route as any)}
                style={[styles.navIcon, isActive && styles.navIconActive]}
              >
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={22}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                />
              </AnimatedIconButton>
            );
          })}
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

export default function TabsLayout() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const segments = useSegments();
  // Hide the tab header when inside a sub-screen (e.g. settings, notifications, trail detail)
  const isSubScreen = segments.length > 2;

  return (
    <View style={styles.container}>
      {!isSubScreen && <Header />}
      <Tabs
        tabBar={() => null}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="shop" />
        <Tabs.Screen name="leaderboard" />
        <Tabs.Screen name="profile" />
      </Tabs>
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
  navIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: Colors.primary + '15',
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
