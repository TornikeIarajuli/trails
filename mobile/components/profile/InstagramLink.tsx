import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Linking, Alert, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors } from '../../constants/colors';
import { instagramUrl } from '../../utils/instagram';
import { haptics } from '../../utils/haptics';

/** "@name" with the Instagram logo; opens the profile in the Instagram app or the browser. */
export function InstagramLink({ handle, style }: { handle: string; style?: StyleProp<ViewStyle> }) {
  const Colors = useColors();
  const open = async () => {
    haptics.tap();
    try {
      await Linking.openURL(instagramUrl(handle));
    } catch {
      Alert.alert('Could not open Instagram', `Look for @${handle} on Instagram.`);
    }
  };
  return (
    <TouchableOpacity
      style={[styles.row, style]}
      onPress={open}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={`Instagram: @${handle}`}
    >
      <Icon name="logo-instagram" size={16} color={Colors.primary} />
      <Text style={[styles.text, { color: Colors.primary }]} numberOfLines={1}>
        @{handle}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
