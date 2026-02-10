import React, { useMemo } from 'react';
import { Tabs, usePathname, router } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: { name: string; route: string; icon: IoniconsName; activeIcon: IoniconsName }[] = [
  { name: 'home', route: '/(tabs)/home', icon: 'compass-outline', activeIcon: 'compass' },
  { name: 'feed', route: '/(tabs)/feed', icon: 'newspaper-outline', activeIcon: 'newspaper' },
  { name: 'leaderboard', route: '/(tabs)/leaderboard', icon: 'trophy-outline', activeIcon: 'trophy' },
  { name: 'profile', route: '/(tabs)/profile', icon: 'person-outline', activeIcon: 'person' },
];

function Header() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <Text style={styles.appTitle}>Mikiri Trails</Text>
      <View style={styles.navIcons}>
        <TouchableOpacity
          style={styles.navIcon}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        {TAB_CONFIG.map((tab) => {
          const isActive = pathname.includes(`/${tab.name}`);
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => router.navigate(tab.route as any)}
              style={[styles.navIcon, isActive && styles.navIconActive]}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={22}
                color={isActive ? Colors.primary : Colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.container}>
      <Header />
      <Tabs
        tabBar={() => null}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="feed" />
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
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: Colors.primary + '15',
  },
});
