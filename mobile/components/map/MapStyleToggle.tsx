import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Icon } from '../ui/Icon';

interface MapStyleToggleProps {
  topo: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Small floating button on a map: "Topo" switches to topographic tiles, "Map" back. */
export function MapStyleToggle({ topo, onToggle, style }: MapStyleToggleProps) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={topo ? 'Show the standard map' : 'Show the topographic map'}
      testID="map-style-toggle"
    >
      <Icon name={topo ? 'map-outline' : 'layers-outline'} size={15} color="#263238" />
      <Text style={styles.label} maxFontSizeMultiplier={1.3}>{topo ? 'Map' : 'Topo'}</Text>
    </TouchableOpacity>
  );
}

// Fixed light colours: the button sits on the map, which stays light in dark mode
const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.95)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#263238',
  },
});
