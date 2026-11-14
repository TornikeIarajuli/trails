import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { haptics } from '../../utils/haptics';

/** The feed with nothing in it yet: what will appear here, and the two ways to fill it. */
export function EmptyFeed() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.container} testID="empty-feed">
      <View style={styles.badge}>
        <Icon name="people-outline" size={40} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Your feed is waiting for its first hike</Text>
      <Text style={styles.subtitle}>
        Follow other hikers to see their hikes, photos and trail reports here. Yours appear too,
        once you finish a trail.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
        onPress={() => {
          haptics.tap();
          router.push('/search');
        }}
        accessibilityRole="button"
        testID="empty-feed-find-hikers"
      >
        <Icon name="person-add-outline" size={18} color={Colors.textOnPrimary} />
        <Text style={styles.primaryText}>Find hikers to follow</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
        onPress={() => {
          haptics.tap();
          router.navigate('/(tabs)/home');
        }}
        accessibilityRole="button"
        testID="empty-feed-explore"
      >
        <Icon name="compass-outline" size={18} color={Colors.primary} />
        <Text style={styles.secondaryText}>Explore trails</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
      gap: 12,
    },
    badge: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '14',
      marginBottom: 4,
    },
    title: {
      fontSize: 19,
      fontWeight: '800',
      color: Colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      alignSelf: 'stretch',
      minHeight: 48,
      borderRadius: 24,
      paddingHorizontal: 20,
    },
    primary: {
      backgroundColor: Colors.primary,
    },
    secondary: {
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    pressed: {
      opacity: 0.85,
    },
    primaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.primary,
    },
  });
