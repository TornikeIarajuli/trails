import React from 'react';
import { Text, StyleSheet, Linking, StyleProp, TextStyle } from 'react-native';
import { TOPO_ATTRIBUTION, TOPO_ATTRIBUTION_URL } from '../../utils/topoTiles';

interface TopoAttributionProps {
  /**
   * `overlay` (default): on the map, bottom-left, raised above the map provider's own logo,
   * which must stay visible too. `inline`: a line in a panel that covers the map's bottom.
   */
  variant?: 'overlay' | 'inline';
  style?: StyleProp<TextStyle>;
}

/** The credit OpenTopoMap's licence requires while its tiles are on screen. */
export function TopoAttribution({ variant = 'overlay', style }: TopoAttributionProps) {
  return (
    <Text
      style={[variant === 'overlay' ? styles.overlay : styles.inline, style]}
      onPress={() => Linking.openURL(TOPO_ATTRIBUTION_URL).catch(() => {})}
      accessibilityRole="link"
      maxFontSizeMultiplier={1.2}
      testID="topo-attribution"
    >
      {TOPO_ATTRIBUTION}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Fixed colours: it sits on the light topo map in dark mode too
  overlay: {
    position: 'absolute',
    left: 6,
    bottom: 30,
    maxWidth: '78%',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.85)',
    color: '#37474F',
    fontSize: 9,
    lineHeight: 12,
  },
  inline: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
    opacity: 0.75,
  },
});
