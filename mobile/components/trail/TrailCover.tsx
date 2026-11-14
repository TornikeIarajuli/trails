import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';

interface TrailCoverProps {
  uri?: string | null;
  /** Size, radius etc. — applied to the photo and to the placeholder alike. */
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  /** Adds a "No photo yet" caption; meant for large covers, not thumbnails. */
  showLabel?: boolean;
  transition?: number;
}

/**
 * A trail's cover photo, or — when the trail has none or it fails to load — a
 * neutral placeholder. Never a stock photo of somewhere else.
 */
export function TrailCover({ uri, style, iconSize = 24, showLabel = false, transition = 180 }: TrailCoverProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, style as StyleProp<ImageStyle>]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={transition}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.placeholder, style]} accessibilityLabel="No photo yet" accessibilityRole="image">
      <Icon name="trail-sign-outline" size={iconSize} color={Colors.primaryLight} />
      {showLabel && <Text style={styles.label}>No photo yet</Text>}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    image: {
      backgroundColor: Colors.borderLight,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: Colors.primary + '14',
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
  });
