import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Icon, IconName } from '../ui/Icon';
import { MAP_STYLES, MapStyle } from '../../store/settingsStore';

const OPTIONS: Record<MapStyle, { label: string; icon: IconName; spoken: string }> = {
  standard: { label: 'Map', icon: 'map-outline', spoken: 'standard map' },
  topo: { label: 'Topo', icon: 'layers-outline', spoken: 'topographic map' },
  satellite: { label: 'Satellite', icon: 'globe-outline', spoken: 'satellite map' },
};

interface MapStylePickerProps {
  value: MapStyle;
  onChange: (style: MapStyle) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Small floating control on a map. Closed, it names the map on screen; tapped, it opens into
 * the three maps (Map, Topo, Satellite) and closes again once one is picked.
 */
export function MapStylePicker({ value, onChange, style }: MapStylePickerProps) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS[value];

  if (!open) {
    return (
      <TouchableOpacity
        style={[styles.pill, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Map: ${current.label}. Change the map`}
        testID="map-style-picker"
      >
        <Icon name={current.icon} size={15} color={INK} />
        <Text style={styles.label} maxFontSizeMultiplier={1.3}>{current.label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.pill, styles.openPill, style]} accessibilityRole="radiogroup" testID="map-style-options">
      {MAP_STYLES.map((key) => {
        const option = OPTIONS[key];
        const selected = key === value;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => {
              setOpen(false);
              onChange(key);
            }}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show the ${option.spoken}`}
            testID={`map-style-${key}`}
          >
            <Icon name={option.icon} size={14} color={selected ? '#FFFFFF' : INK} />
            <Text style={[styles.label, selected && styles.labelSelected]} maxFontSizeMultiplier={1.3}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Fixed light colours: the control sits on the map, which stays light in dark mode
const INK = '#263238';

const styles = StyleSheet.create({
  pill: {
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
  openPill: {
    gap: 2,
    paddingHorizontal: 3,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 14,
  },
  optionSelected: {
    backgroundColor: INK,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: INK,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
