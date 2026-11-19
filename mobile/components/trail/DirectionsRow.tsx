import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Platform, Share } from 'react-native';
import { Icon } from '../ui/Icon';
import { ActionSheet, ActionSheetOption } from '../ui/ActionSheet';
import { useColors, ColorPalette } from '../../constants/colors';
import {
  DirectionsApp,
  directionsChoices,
  directionsUrl,
  formatCoordinates,
  placeUrl,
  shareLocationMessage,
} from '../../utils/directions';
import { analytics } from '../../utils/analytics';
import { haptics } from '../../utils/haptics';

interface DirectionsRowProps {
  trailId: string;
  trailName: string;
  start: { latitude: number; longitude: number } | null;
}

/**
 * Below the trail map: driving directions to the start in Google Maps, Waze or another maps app,
 * or the start's location sent to friends.
 */
export function DirectionsRow({ trailId, trailName, start }: DirectionsRowProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [open, setOpen] = useState(false);

  if (!start) return null;

  const destination = { ...start, label: `Start of ${trailName}` };
  const coordinates = formatCoordinates(start);
  const options: ActionSheetOption[] = [
    ...directionsChoices(Platform.OS).map((choice) => ({
      key: choice.key,
      label: choice.label,
      icon: choice.key === 'other' ? ('map-outline' as const) : ('navigate-outline' as const),
    })),
    { key: 'share', label: 'Share the location', icon: 'share-social-outline' },
  ];

  const choose = async (key: string) => {
    analytics.directionsOpened(trailId, key);
    if (key === 'share') {
      await Share.share({ message: shareLocationMessage(trailName, start) }).catch(() => {});
      return;
    }
    try {
      await Linking.openURL(directionsUrl(key as DirectionsApp, destination));
    } catch {
      // No app takes the link (no maps app for "another app"): the web map always opens
      Linking.openURL(placeUrl(start)).catch(() => {
        Alert.alert('Could not open a map', `The start is at ${coordinates}.`);
      });
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          haptics.tap();
          setOpen(true);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Directions to the start, ${coordinates}`}
        testID="directions-row"
      >
        <Icon name="car-outline" size={20} color={Colors.primary} />
        <View style={styles.textBlock}>
          <Text style={styles.title}>Directions to the start</Text>
          <Text style={styles.hint}>{coordinates}</Text>
        </View>
        <Icon name="chevron-forward" size={16} color={Colors.textLight} />
      </TouchableOpacity>

      <ActionSheet
        visible={open}
        title="Directions to the start"
        message={`${trailName} starts at ${coordinates}.`}
        options={options}
        onSelect={choose}
        onClose={() => setOpen(false)}
        closeOnSelect
      />
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    hint: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });
