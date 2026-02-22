import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useColors, ColorPalette } from '../../constants/colors';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  image: {
    backgroundColor: Colors.borderLight,
  },
  placeholder: {
    backgroundColor: Colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: '600',
    color: Colors.primary,
  },
});
