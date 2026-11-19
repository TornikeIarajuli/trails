import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Icon } from '../../../components/ui/Icon';
import { PostList } from '../../../components/feed/PostList';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useSavedPosts } from '../../../hooks/useFeed';

/** Profile > Saved posts: the posts you kept for later, most recently saved first. */
export default function SavedPostsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const query = useSavedPosts();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Saved posts',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        <PostList
          query={query}
          errorTitle="Couldn't load your saved posts"
          testID="saved-posts"
          empty={
            <View style={styles.empty} testID="saved-posts-empty">
              <View style={styles.badge}>
                <Icon name="bookmark-outline" size={36} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Nothing saved yet</Text>
              <Text style={styles.subtitle}>
                Tap the bookmark under any post in the feed to keep it here: a trip report, a photo of a
                pass, a fresh condition report.
              </Text>
            </View>
          }
        />
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
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
      gap: 12,
    },
    badge: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '14',
      marginBottom: 4,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: Colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
  });
