import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '../ui/Icon';

/**
 * The big heart that pops over a photo when it is double-tapped. Plays each time `trigger`
 * changes; with reduced motion it only fades in and out.
 */
export function HeartBurst({ trigger, size = 96 }: { trigger: number; size?: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (trigger === 0) return;
    if (reducedMotion) {
      scale.value = 1;
      opacity.value = withSequence(withTiming(1, { duration: 90 }), withDelay(450, withTiming(0, { duration: 160 })));
      return;
    }
    scale.value = 0.3;
    opacity.value = 1;
    scale.value = withSequence(
      withSpring(1.15, { damping: 9, stiffness: 260 }),
      withSpring(1, { damping: 14, stiffness: 220 }),
      withDelay(260, withTiming(0.7, { duration: 180 })),
    );
    opacity.value = withDelay(600, withTiming(0, { duration: 180 }));
  }, [trigger, reducedMotion, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (trigger === 0) return null;
  return (
    <View style={styles.center} pointerEvents="none">
      <Animated.View style={[styles.heart, style]} testID="heart-burst">
        <Icon name="heart" size={size} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A soft shadow keeps the white heart visible on bright snow and sky
  heart: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
