import React, { memo } from 'react';
import type { ColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
// Only the Ionicons font (the fallback); importing '@expo/vector-icons' itself would bundle all 19 icon fonts
import Ionicons from '@expo/vector-icons/Ionicons';
import { SKETCHY_PATHS, SketchyName } from './icons/sketchyPaths';
import { FILLED_SHAPES, IONICON_TO_SKETCHY, splitIoniconName } from './iconMap';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** An Ionicons name (as used across the app) or a Sketchy drawing's own name. */
export type IconName = IoniconName | SketchyName;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle | TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/** The hand-drawn paths for a name, and whether to paint the shape in; null = no drawing. */
export function resolveIcon(name: string): { paths: readonly string[]; filled: boolean } | null {
  const { base, outline } = splitIoniconName(name);
  const mapped = IONICON_TO_SKETCHY[base];
  if (mapped && mapped in SKETCHY_PATHS) {
    return { paths: SKETCHY_PATHS[mapped as SketchyName], filled: !outline && FILLED_SHAPES.has(base) };
  }
  if (name in SKETCHY_PATHS) return { paths: SKETCHY_PATHS[name as SketchyName], filled: false };
  return null;
}

/**
 * The app's icon: hand-drawn Sketchy Icons drawn with react-native-svg, falling back to Ionicons
 * for any name without a drawing. Takes the same props as Ionicons.
 */
function IconImpl({ name, size = 12, color = '#000', style, testID, accessibilityLabel }: IconProps) {
  const drawing = resolveIcon(name);
  if (!drawing) {
    return (
      <Ionicons
        name={name as IoniconName}
        size={size}
        color={color}
        style={style as StyleProp<TextStyle>}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style as StyleProp<ViewStyle>}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'auto' : 'no-hide-descendants'}
    >
      {drawing.paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={drawing.filled && i === 0 ? color : 'none'}
        />
      ))}
    </Svg>
  );
}

export const Icon = memo(IconImpl);
