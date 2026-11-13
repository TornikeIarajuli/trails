// TEMPORARY (requested by the owner for testing over-the-air updates): a manual
// "Check for updates" control on the own-profile card. Remove once updates are trusted
// to arrive on their own (hooks/useOtaUpdates.ts already checks on launch and foreground).
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useColors, ColorPalette } from '../../constants/colors';
import { useHikeStore } from '../../store/hikeStore';

/** "Built in" for the update bundled with the APK, else the first characters of the update id. */
export function describeRunningUpdate(updateId: string | null | undefined, isEmbedded: boolean): string {
  if (isEmbedded || !updateId) return 'built-in';
  return updateId.slice(0, 8);
}

export function UpdateCheckButton() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [checking, setChecking] = useState(false);

  const running = describeRunningUpdate(Updates.updateId, Updates.isEmbeddedLaunch);
  const channel = Updates.channel || 'none';

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
      Alert.alert('Updates are off', 'Over-the-air updates only work in installed builds, not in development.');
      return;
    }
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert('Up to date', 'You already have the latest version.');
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('Update downloaded', 'Restart the app to use it.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart now', onPress: restart },
      ]);
    } catch (err) {
      Alert.alert('Update check failed', err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.button}
        onPress={check}
        disabled={checking}
        accessibilityRole="button"
        accessibilityLabel="Check for app updates"
      >
        {checking ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name="refresh" size={16} color={Colors.primary} />
        )}
        <Text style={styles.buttonText}>{checking ? 'Checking…' : 'Check for updates'}</Text>
      </TouchableOpacity>
      <Text style={styles.meta}>
        Version {running} · channel {channel}
      </Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: { alignItems: 'center', marginTop: 10, gap: 4 },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    buttonText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
    meta: { fontSize: 11, color: Colors.textLight },
  });
