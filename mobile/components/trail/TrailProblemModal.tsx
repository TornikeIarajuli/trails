import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useColors, ColorPalette } from '../../constants/colors';
import { useReportContent } from '../../hooks/useModeration';
import {
  REPORT_DETAILS_MAX,
  ReportReason,
  TRAIL_PROBLEM_REASONS,
} from '../../services/moderation';
import { TRAIL_REPORT_THANKS, trailReportErrorMessage } from '../../utils/trailReview';
import { haptics } from '../../utils/haptics';
import { Sheet, SheetButton, SheetTextInput } from '../ui/Sheet';

interface TrailProblemModalProps {
  trailId: string;
  visible: boolean;
  onClose: () => void;
}

/** "Report a problem with this trail": wrong route, missing path, wrong info… */
export function TrailProblemModal({ trailId, visible, onClose }: TrailProblemModalProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const report = useReportContent();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  // A fresh form each time it opens; while it slides away it keeps what was chosen
  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetails('');
  }, [visible]);

  const submit = () => {
    if (!reason || report.isPending) return;
    const text = details.trim().slice(0, REPORT_DETAILS_MAX);
    report.mutate(
      { target_type: 'trail', target_id: trailId, reason, details: text || undefined },
      {
        onSuccess: () => {
          haptics.success();
          onClose();
          Alert.alert('Report sent', TRAIL_REPORT_THANKS);
        },
        onError: (err) => Alert.alert("Couldn't send the report", trailReportErrorMessage(err)),
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Report a problem"
      closeLabel="Close report form"
      dismissible={!report.isPending}
      footer={
        <SheetButton title="Send report" onPress={submit} disabled={!reason} loading={report.isPending} />
      }
    >
      <Text style={styles.label}>What is wrong with this trail?</Text>
      {TRAIL_PROBLEM_REASONS.map((option) => {
        const selected = reason === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => setReason(option.key)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.optionText}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.label, styles.detailsLabel]}>Details (optional)</Text>
      <SheetTextInput
        style={styles.input}
        placeholder="What did you find on the ground?"
        placeholderTextColor={Colors.textLight}
        value={details}
        onChangeText={setDetails}
        maxLength={REPORT_DETAILS_MAX}
        multiline
        accessibilityLabel="Details"
      />
      <Text style={styles.counter}>
        {details.length}/{REPORT_DETAILS_MAX}
      </Text>
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: 8,
    },
    detailsLabel: {
      marginTop: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: 10,
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    optionSelected: {
      borderColor: Colors.primary,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: Colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.primary,
    },
    optionText: {
      flex: 1,
      fontSize: 15,
      color: Colors.text,
    },
    input: {
      minHeight: 80,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: Colors.text,
      backgroundColor: Colors.background,
      textAlignVertical: 'top',
    },
    counter: {
      fontSize: 12,
      color: Colors.textLight,
      textAlign: 'right',
      marginTop: 4,
    },
  });
