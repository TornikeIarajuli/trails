// TEMPORARY (requested by the owner for testing over-the-air updates): a manual
// "Check for updates" control on the own-profile card. Remove once updates are trusted
// to arrive on their own (hooks/useOtaUpdates.ts already checks on launch and foreground).
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../ui/Icon';
import * as Updates from 'expo-updates';
import { useColors, ColorPalette } from '../../constants/colors';
import { useHikeStore } from '../../store/hikeStore';
import { describeRunningUpdate } from '../../utils/otaInfo';

/** A small icon button; which update is running is shown in its messages. */
export function UpdateCheckButton() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [checking, setChecking] = useState(false);

  const version = `Version ${describeRunningUpdate(Updates.updateId, Updates.isEmbeddedLaunch)} · channel ${Updates.channel || 'none'}`;

  const restart = () => {
    if (useHikeStore.getState().isActive) {
      Alert.alert('Update downloaded', 'It will be applied after your hike, the next time the app starts.');
      return;
    }
    Updates.reloadAsync().catch((err: unknown) =>
      Alert.alert('Could not restart', err instanceof Error ? err.message : String(err)),
    );
  };

  const check = async () => {
    if (!Updates.isEnabled) {
      Alert.alert('Updates are off', `Over-the-air updates only work in installed builds, not in development.\n\n${version}`);
      return;
    }
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert('Up to date', `You already have the latest version.\n\n${version}`);
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('Update downloaded', `Restart the app to use it.\n\nNow running: ${version}`, [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart now', onPress: restart },
      ]);
    } catch (err) {
      Alert.alert('Update check failed', `${err instanceof Error ? err.message : String(err)}\n\n${version}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={check}
      disabled={checking}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Check for app updates. ${version}`}
    >
      {checking ? (
        <ActivityIndicator size="small" color={Colors.text} />
      ) : (
        <Icon name="cloud-download-outline" size={19} color={Colors.text} />
      )}
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    button: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
  });
