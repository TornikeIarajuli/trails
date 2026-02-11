import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../constants/colors';
import { useSettingsStore } from '../store/settingsStore';

const { width } = Dimensions.get('window');

interface OnboardingPage {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

const PAGES: OnboardingPage[] = [
  {
    id: '1',
    icon: 'trail-sign',
    title: 'Discover Trails',
    subtitle:
      'Explore 200+ hiking trails across Georgia — from alpine glaciers in Svaneti to lush forests in Adjara.',
  },
  {
    id: '2',
    icon: 'navigate',
    title: 'Track Your Hikes',
    subtitle:
      'Follow GPS routes, check in at waypoints, and earn badges as you conquer trails of every difficulty.',
  },
  {
    id: '3',
    icon: 'people',
    title: 'Join the Community',
    subtitle:
      'Follow fellow hikers, share trail photos, and climb the leaderboard together.',
  },
];

export default function OnboardingScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const setHasSeenOnboarding = useSettingsStore((s) => s.setHasSeenOnboarding);

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const handleGetStarted = () => {
    setHasSeenOnboarding();
    router.replace('/(auth)/login');
  };

  const isLastPage = currentIndex === PAGES.length - 1;

  const renderPage = ({ item }: { item: OnboardingPage }) => (
    <View style={[styles.page, { width }]}>
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={100} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleGetStarted}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Dots + Button */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={isLastPage ? handleGetStarted : handleNext}
        >
          <Text style={styles.buttonText}>
            {isLastPage ? 'Get Started' : 'Next'}
          </Text>
          {!isLastPage && (
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    skipButton: {
      position: 'absolute',
      top: 56,
      right: 24,
      zIndex: 10,
    },
    skipText: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    page: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    iconContainer: {
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: Colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 48,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: Colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      alignItems: 'center',
      gap: 24,
    },
    dots: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotActive: {
      backgroundColor: Colors.primary,
      width: 28,
    },
    dotInactive: {
      backgroundColor: Colors.border,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 14,
      width: '100%',
      gap: 8,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#fff',
    },
  });
