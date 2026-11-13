import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItemInfo,
} from 'react-native';
import { TrailMedia } from '../../types/trail';
import {
  buildPhotoSlides,
  coverCreditFromList,
  PhotoCreditEntry,
  PhotoSlide,
} from '../../utils/trailPhotos';
import photoCreditsJson from '../../assets/data/photo-credits.json';
import { TrailCover } from './TrailCover';

const CAROUSEL_HEIGHT = 280;
const PLACEHOLDER_HEIGHT = 220;
const MAX_DOTS = 8;
const PHOTO_CREDITS = photoCreditsJson as unknown as PhotoCreditEntry[];

interface TrailPhotoCarouselProps {
  coverUrl: string | null;
  media: TrailMedia[];
  /** Used to find the cover's credit when the cover is not part of the gallery. */
  trailId?: string;
}

export function TrailPhotoCarousel({ coverUrl, media, trailId }: TrailPhotoCarouselProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const slides = useMemo(
    () => buildPhotoSlides(coverUrl, media, coverCreditFromList(coverUrl, trailId, PHOTO_CREDITS)),
    [coverUrl, media, trailId],
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const renderSlide = useCallback(
    ({ item }: ListRenderItemInfo<PhotoSlide>) => (
      <View style={{ width, height: CAROUSEL_HEIGHT }}>
        <TrailCover uri={item.url} style={styles.fill} iconSize={48} showLabel transition={200} />
        {item.credit && (
          <View style={styles.credit}>
            <Text style={styles.creditText} numberOfLines={1}>
              {item.credit}
            </Text>
          </View>
        )}
      </View>
    ),
    [width],
  );

  if (slides.length === 0) {
    return (
      <TrailCover
        uri={null}
        style={{ width, height: PLACEHOLDER_HEIGHT }}
        iconSize={48}
        showLabel
      />
    );
  }

  const current = Math.min(index, slides.length - 1);

  return (
    <View
      style={styles.carousel}
      accessibilityLabel={`Trail photo ${current + 1} of ${slides.length}`}
    >
      {/* A virtualised list, so only the visible photo and its neighbours are downloaded */}
      <FlatList
        data={slides}
        keyExtractor={(slide) => slide.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        getItemLayout={(_data, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onScrollEnd}
      />

      {slides.length > 1 && (
        <View style={styles.pagerRow} pointerEvents="none">
          <View style={styles.pager}>
            {slides.length <= MAX_DOTS ? (
              slides.map((slide, i) => (
                <View key={slide.id} style={[styles.dot, i === current && styles.dotActive]} />
              ))
            ) : (
              <Text style={styles.counter}>
                {current + 1} / {slides.length}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    height: CAROUSEL_HEIGHT,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  credit: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  creditText: {
    fontSize: 11,
    color: '#fff',
  },
  // Sits above the credit strip so the two never overlap
  pagerRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: 'center',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  counter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
