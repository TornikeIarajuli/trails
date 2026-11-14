import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Icon } from '../ui/Icon';
import { useLineWarning } from '../../utils/lineWatch';

// The same in every theme: this has to stand out on any map
const OCCUPATION_RED = '#B91C1C';
const BORDER_AMBER = '#B45309';

const MORE: Record<string, string> = {
  occupation_close:
    'The occupation line is often not marked on the ground, and people near it have been detained. Go back along the trail you came on. If you are lost or need help, call 112.',
  occupation:
    'The occupation line is often not marked on the ground, and people near it have been detained. Stay on the marked trail and do not go further toward it.',
  border:
    'Crossing the state border away from a border crossing is against the law. Stay on the trail and carry your passport.',
};

/**
 * On the hike screen while the occupation line or the state border is near: what it is, how
 * far, and what to do. Tap for more. Distances are approximate.
 */
export function LineWarningBanner({ top }: { top: number }) {
  const warning = useLineWarning((s) => s.warning);
  if (!warning) return null;

  const occupation = warning.level !== 'border';
  return (
    <Pressable
      style={[styles.banner, { top, backgroundColor: occupation ? OCCUPATION_RED : BORDER_AMBER }]}
      onPress={() => Alert.alert(warning.title, `${MORE[warning.level]}\n\nDistances are approximate.`)}
      accessibilityRole="alert"
      accessibilityLabel={`${warning.title}. ${warning.body}`}
      testID="line-warning"
    >
      <Icon name="warning" size={22} color="#FFFFFF" />
      <View style={styles.text}>
        <Text style={styles.title}>{warning.title}</Text>
        <Text style={styles.body}>{warning.body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
  },
});
