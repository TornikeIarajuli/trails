import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineMapsStore } from '../../store/offlineMapsStore';
import { TilePlan, estimatePlanBytes, formatMegabytes } from '../../utils/topoTiles';
import { haptics } from '../../utils/haptics';

/** Starts saving a trail's topo map; shared by the row and the trail screen's save-offline button. */
export async function startTopoDownload(trailId: string, trailName: string, plan: TilePlan) {
  haptics.tap();
  const result = await useOfflineMapsStore.getState().download(trailId, trailName, plan);
  if (result === 'done') haptics.success();
  else if (result === 'busy') {
    Alert.alert(
      'Another download is running',
      'One topo map downloads at a time. Try again when the current one has finished.',
    );
  }
}

export function topoDownloadSizeLabel(plan: TilePlan): string {
  return `~${formatMegabytes(estimatePlanBytes(plan))}`;
}

interface TopoDownloadRowProps {
  trailId: string;
  trailName: string;
  plan: TilePlan;
}

/** Below the trail map: save its topo tiles for offline use, follow the download, or remove them. */
export function TopoDownloadRow({ trailId, trailName, plan }: TopoDownloadRowProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const offline = useNetworkStatus() === 'offline';
  const load = useOfflineMapsStore((s) => s.load);
  const saved = useOfflineMapsStore((s) => s.saved[trailId]);
  const active = useOfflineMapsStore((s) => s.active);
  const failed = useOfflineMapsStore((s) => s.failedTrailId === trailId);

  useEffect(() => {
    load();
  }, [load]);

  if (plan.tiles.length === 0) return null;

  if (saved) {
    const confirmRemove = () => {
      Alert.alert('Remove the topo map?', 'It is deleted from this phone. You can download it again later.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            haptics.tap();
            useOfflineMapsStore.getState().remove(trailId);
          },
        },
      ]);
    };
    return (
      <View style={styles.row} testID="topo-download-row">
        <Icon name="checkmark-circle" size={20} color={Colors.success} />
        <Text style={styles.title}>Topo map saved on this phone</Text>
        <TouchableOpacity
          onPress={confirmRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Remove the saved topo map"
        >
          <Text style={styles.action}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (active?.trailId === trailId) {
    const ratio = active.total > 0 ? active.done / active.total : 0;
    const percent = Math.round(ratio * 100);
    return (
      <View
        style={[styles.row, styles.column]}
        testID="topo-download-row"
        accessibilityLabel={`Downloading the topo map, ${percent} percent`}
      >
        <View style={styles.progressHeader}>
          <Text style={styles.title}>Downloading topo map… {percent}%</Text>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              useOfflineMapsStore.getState().cancel();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel the topo map download"
          >
            <Text style={styles.action}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(2, percent)}%` }]} />
        </View>
      </View>
    );
  }

  const busyElsewhere = !!active;
  const disabled = offline || busyElsewhere;
  let hint: string | null = null;
  if (offline) hint = 'Connect to the internet to download it.';
  else if (busyElsewhere) hint = 'Another topo map is downloading.';
  else if (failed) hint = 'The last download stopped. Check your connection and try again.';
  const label = `Download topo map for offline use · ${topoDownloadSizeLabel(plan)}`;

  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabled]}
      onPress={() => startTopoDownload(trailId, trailName, plan)}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ disabled }}
      testID="topo-download-row"
    >
      <Icon
        name={offline ? 'cloud-offline-outline' : 'cloud-download-outline'}
        size={20}
        color={Colors.primary}
      />
      <View style={styles.textBlock}>
        <Text style={styles.blockTitle}>{label}</Text>
        {hint && <Text style={[styles.hint, failed && !disabled && styles.hintError]}>{hint}</Text>}
      </View>
      {!disabled && <Icon name="chevron-forward" size={16} color={Colors.textLight} />}
    </TouchableOpacity>
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
    column: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8,
    },
    disabled: {
      opacity: 0.6,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    blockTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    hint: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    hintError: {
      color: Colors.error,
    },
    action: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.primary,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.borderLight,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: Colors.primary,
    },
  });
