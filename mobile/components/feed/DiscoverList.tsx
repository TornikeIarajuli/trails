import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useDiscoverFeed } from '../../hooks/useFeed';
import { haptics } from '../../utils/haptics';
import { PostList } from './PostList';
import { SuggestedHikers } from './SuggestedHikers';

/** Discover's top: hikers to follow, then the title of the posts below. */
function DiscoverHeader({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View>
      <SuggestedHikers />
      <Text style={styles.sectionTitle}>Popular now</Text>
    </View>
  );
}

/** Nobody has shared anything yet (or only you have). */
function EmptyDiscover({ styles, Colors }: { styles: ReturnType<typeof createStyles>; Colors: ColorPalette }) {
  return (
    <View style={styles.empty} testID="empty-discover">
      <Icon name="compass-outline" size={36} color={Colors.textLight} />
      <Text style={styles.emptyTitle}>No hikes shared yet</Text>
      <Text style={styles.emptyText}>Finish a trail and yours will be among the first here.</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
        onPress={() => {
          haptics.tap();
          router.navigate('/(tabs)/home');
        }}
        accessibilityRole="button"
        testID="empty-discover-explore"
      >
        <Text style={styles.buttonText}>Explore trails</Text>
      </Pressable>
    </View>
  );
}

/**
 * The Feed tab's Discover segment: hikers to follow, and everyone's posts, best first. It is
 * what a new user, who follows nobody yet, can look at.
 */
export function DiscoverList() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const query = useDiscoverFeed();

  return (
    <PostList
      query={query}
      header={<DiscoverHeader styles={styles} />}
      empty={<EmptyDiscover styles={styles} Colors={Colors} />}
      errorTitle="Couldn't load Discover"
      testID="discover-list"
    />
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.text,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 32,
      paddingVertical: 40,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    button: {
      marginTop: 8,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
  });
