import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';

export function EmptyFeed() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.container}>
      <Icon name="newspaper-outline" size={56} color={Colors.textLight} />
      <Text style={styles.title}>Your feed is empty</Text>
      <Text style={styles.subtitle}>
        Your hikes, photos and trail reports show up here, along with those of the hikers you follow.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/search')}
        accessibilityRole="button"
      >
        <Icon name="search-outline" size={18} color={Colors.textOnPrimary} />
        <Text style={styles.buttonText}>Find Hikers</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
