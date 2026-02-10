import React, { useMemo } from 'react';
import { TouchableOpacity, Share, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Trail } from '../../types/trail';

interface ShareButtonProps {
  trail: Trail;
  style?: ViewStyle;
}

export function ShareButton({ trail, style }: ShareButtonProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handleShare = async () => {
    const parts = [trail.name_en];
    if (trail.distance_km) parts.push(`${trail.distance_km}km`);
    if (trail.elevation_gain_m) parts.push(`${trail.elevation_gain_m}m elevation`);
    parts.push(`Difficulty: ${trail.difficulty}`);
    parts.push(`Region: ${trail.region}`);

    await Share.share({
      message: `Check out this trail in Georgia!\n\n${parts.join(' | ')}`,
      title: trail.name_en,
    });
  };

  return (
    <TouchableOpacity style={[styles.button, style]} onPress={handleShare}>
      <Ionicons name="share-social-outline" size={20} color={Colors.text} />
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface + 'E0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
});
