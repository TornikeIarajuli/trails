import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useLogPastHike } from '../../hooks/useCompletions';
import { pastHikeErrorMessage, pastHikeYearOptions } from '../../utils/pastHikes';
import { haptics } from '../../utils/haptics';
import { PastHikeResponse } from '../../types/completion';
import { Sheet, SheetButton } from '../ui/Sheet';

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
    <Sheet
      visible={visible}
      onClose={onClose}
      title="When did you hike it?"
      dismissible={!saving}
      footer={
        <>
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          <SheetButton
            title={year === null ? 'Pick a year' : `Mark as done · ${year}`}
            onPress={handleConfirm}
            disabled={year === null}
            loading={saving}
          />
        </>
      }
    >
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

      {/* The sheet's body scrolls, so the long run of earlier years needs no scroller of its own */}
      {showEarlier && <View style={[styles.chips, styles.earlier]}>{years.earlier.map(renderChip)}</View>}
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  explainer: {
    fontSize: 14,
    lineHeight: 20,
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
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 20,
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
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
});
