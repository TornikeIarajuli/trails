import React, { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0–1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  style?: StyleProp<ViewStyle>;
  /** Drawn in the middle of the ring (e.g. the percentage). */
  children?: React.ReactNode;
}

/** A circular progress indicator that fills clockwise from the top. */
export function ProgressRing({ progress, size = 40, strokeWidth = 4, color, trackColor, style, children }: ProgressRingProps) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = useSharedValue(clamped);

  useEffect(() => {
    shown.value = reducedMotion ? clamped : withTiming(clamped, { duration: 250 });
  }, [clamped, reducedMotion, shown]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shown.value),
  }));

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}
