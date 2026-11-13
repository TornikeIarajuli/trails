import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useLogPastHike } from '../../hooks/useCompletions';
import { pastHikeErrorMessage, pastHikeYearOptions } from '../../utils/pastHikes';
import { haptics } from '../../utils/haptics';
import { PastHikeResponse } from '../../types/completion';

interface Props {
  trailId: string;
  visible: boolean;
  onClose: () => void;
  /** The server has recorded the past hike, or reported the trail as already done. */
  onLogged: (result: PastHikeResponse) => void;
}

/** "When did you hike it?" — marks a trail as done for a hike from before the app. */
export function PastHikeModal({ trailId, visible, onClose, onLogged }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const logPastHike = useLogPastHike();

  const [year, setYear] = useState<number | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Worked out each time the sheet opens
  const years = useMemo(() => pastHikeYearOptions(), [visible]);

  useEffect(() => {
    if (!visible) return;
    setYear(null);
    setShowEarlier(false);
    setErrorMsg('');
  }, [visible]);

  const saving = logPastHike.isPending;

  const handleClose = () => {
    if (!saving) onClose();
  };

  const pick = (value: number) => {
    haptics.select();
    setYear(value);
    setErrorMsg('');
  };

  const handleConfirm = () => {
    if (year === null || saving) return;
    setErrorMsg('');
    logPastHike.mutate(
      { trailId, year },
      {
        onSuccess: (result) => {
          haptics.success();
          onLogged(result);
        },
        onError: (error) => setErrorMsg(pastHikeErrorMessage(error)),
      },
    );
  };

  const renderChip = (value: number) => {
    const selected = value === year;
    return (
      <TouchableOpacity
        key={value}
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={() => pick(value)}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: saving }}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{value}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>When did you hike it?</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={saving}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.explainer}>
            It will show on your profile and in My Georgia. The leaderboard counts only hikes recorded with the app.
          </Text>

          <View style={styles.chips}>
            {years.recent.map(renderChip)}
            {years.earlier.length > 0 && !showEarlier && (
              <TouchableOpacity
                style={styles.chip}
                onPress={() => {
                  haptics.tap();
                  setShowEarlier(true);
                }}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Show earlier years"
              >
                <Text style={styles.chipText}>Earlier…</Text>
              </TouchableOpacity>
            )}
          </View>

          {showEarlier && (
            <ScrollView style={styles.earlier} contentContainerStyle={styles.chips} nestedScrollEnabled>
              {years.earlier.map(renderChip)}
            </ScrollView>
          )}

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.confirm, (year === null || saving) && styles.confirmDisabled]}
            onPress={handleConfirm}
            disabled={year === null || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: year === null || saving, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.confirmText}>{year === null ? 'Pick a year' : `Mark as done · ${year}`}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  explainer: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  chipTextSelected: {
    color: Colors.textOnPrimary,
  },
  earlier: {
    maxHeight: 180,
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.error + '12',
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  confirm: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
