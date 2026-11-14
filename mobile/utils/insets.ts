import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A scroll container's content style with room for the system navigation bar added under its
 * own bottom padding. The app draws edge to edge, so screens without the tab bar would
 * otherwise end under the phone's buttons.
 */
export function withBottomInset(style: StyleProp<ViewStyle>, inset: number, fallback = 16): StyleProp<ViewStyle> {
  const flat = StyleSheet.flatten(style) ?? {};
  const own =
    typeof flat.paddingBottom === 'number'
      ? flat.paddingBottom
      : typeof flat.paddingVertical === 'number'
        ? flat.paddingVertical
        : typeof flat.padding === 'number'
          ? flat.padding
          : fallback;
  return [style, { paddingBottom: own + inset }];
}
