import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useColors, ColorPalette } from '../../constants/colors';
import { useDoubleTap } from '../../hooks/useDoubleTap';
import { HeartBurst } from './HeartBurst';
import type { PostMediaKind } from '../../utils/feedPost';

const BLURHASH = 'L76F~B?bWD%M~qxuxEtS%MNFWqxt';
/** Photos are shown 4:5 (portrait, as Instagram's tallest), but never taller than this share of the screen. */
const MAX_SCREEN_SHARE = 0.55;

interface PostMediaProps {
  urls: string[];
  /** A trail cover stands in for hike photos: shown wider (16:9), so it does not pass for one. */
  kind: Exclude<PostMediaKind, 'none'>;
  onDoubleTap: () => void;
  onSingleTap?: () => void;
  /** Counts double taps; each change plays the heart. */
  burstTrigger: number;
  accessibilityLabel: string;
}

/** A post's photo, or a pager of photos with dots. Double-tap likes; a single tap opens the trail. */
export function PostMedia({ urls, kind, onDoubleTap, onSingleTap, burstTrigger, accessibilityLabel }: PostMediaProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const [page, setPage] = useState(0);
  const onPress = useDoubleTap({ onDoubleTap, onSingleTap });

  const height =
    kind === 'cover'
      ? Math.round((width * 9) / 16)
      : Math.round(Math.min(width * 1.25, window.height * MAX_SCREEN_SHARE));
  const many = urls.length > 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const photo = (url: string, index: number) => (
    <Pressable
      key={`${index}-${url}`}
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={many ? `${accessibilityLabel}, photo ${index + 1} of ${urls.length}` : accessibilityLabel}
      accessibilityHint={onSingleTap ? 'Opens the trail' : undefined}
      testID="post-photo"
    >
      <Image
        source={{ uri: url }}
        placeholder={{ blurhash: BLURHASH }}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={{ width, height, backgroundColor: Colors.borderLight }}
      />
    </Pressable>
  );

  return (
    <View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {many ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            testID="post-pager"
          >
            {urls.map(photo)}
          </ScrollView>
        ) : (
          photo(urls[0], 0)
        )}
        {many && (
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>
              {page + 1}/{urls.length}
            </Text>
          </View>
        )}
        <HeartBurst trigger={burstTrigger} />
      </View>
      {many && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {urls.map((url, i) => (
            <View key={`${i}-${url}`} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    // Fixed colours: the counter sits on the photo
    counter: {
      position: 'absolute',
      top: 10,
      right: 10,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    counterText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
      paddingTop: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.border,
    },
    dotActive: {
      backgroundColor: Colors.primary,
    },
  });
