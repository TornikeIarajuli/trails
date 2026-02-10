import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';

export function EmptyFeed() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.container}>
      <Ionicons name="newspaper-outline" size={56} color={Colors.borderLight} />
      <Text style={styles.title}>Your feed is empty</Text>
      <Text style={styles.subtitle}>
        Follow other hikers to see their trail completions, photos, and reports here.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/search')}
      >
        <Ionicons name="search-outline" size={18} color="#fff" />
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
    color: '#fff',
  },
});
