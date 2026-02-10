import React, { useMemo } from 'react';
import {
  View,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { TrailMedia } from '../../types/trail';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrailPhotoCarouselProps {
  coverUrl: string | null;
  media: TrailMedia[];
}

export function TrailPhotoCarousel({ coverUrl, media }: TrailPhotoCarouselProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const images = [
    ...(coverUrl ? [{ id: 'cover', url: coverUrl }] : []),
    ...media.filter((m) => m.type === 'photo').map((m) => ({ id: m.id, url: m.url })),
  ];

  if (images.length === 0) {
    return (
      <View style={[styles.placeholder, { width: SCREEN_WIDTH }]}>
        <Text style={styles.placeholderText}>No photos</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.carousel}
    >
      {images.map((img) => (
        <Image
          key={img.id}
          source={{ uri: img.url }}
          style={[styles.image, { width: SCREEN_WIDTH }]}
          resizeMode="cover"
        />
      ))}
    </ScrollView>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  carousel: {
    height: 280,
  },
  image: {
    height: 280,
    backgroundColor: Colors.borderLight,
  },
  placeholder: {
    height: 200,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: Colors.textLight,
    fontSize: 16,
  },
});
