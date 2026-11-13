import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { useReportContent } from '../../hooks/useModeration';
import {
  REPORT_DETAILS_MAX,
  ReportReason,
  TRAIL_PROBLEM_REASONS,
} from '../../services/moderation';
import { TRAIL_REPORT_THANKS, trailReportErrorMessage } from '../../utils/trailReview';

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

  const reset = () => {
    setReason(null);
    setDetails('');
  };

  const close = () => {
    if (report.isPending) return;
    reset();
    onClose();
  };

  const submit = () => {
    if (!reason || report.isPending) return;
    const text = details.trim().slice(0, REPORT_DETAILS_MAX);
    report.mutate(
      { target_type: 'trail', target_id: trailId, reason, details: text || undefined },
      {
        onSuccess: () => {
          reset();
          onClose();
          Alert.alert('Report sent', TRAIL_REPORT_THANKS);
        },
        onError: (err) => Alert.alert("Couldn't send the report", trailReportErrorMessage(err)),
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Report a problem</Text>
            <TouchableOpacity
              onPress={close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close report form"
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
            <TextInput
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
          </ScrollView>

          <TouchableOpacity
            style={[styles.submit, (!reason || report.isPending) && styles.submitDisabled]}
            onPress={submit}
            disabled={!reason || report.isPending}
            accessibilityRole="button"
          >
            {report.isPending ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.submitText}>Send report</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: Colors.text,
    },
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
      backgroundColor: Colors.surface,
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
      backgroundColor: Colors.surface,
      textAlignVertical: 'top',
    },
    counter: {
      fontSize: 12,
      color: Colors.textLight,
      textAlign: 'right',
      marginTop: 4,
    },
    submit: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    submitDisabled: {
      opacity: 0.5,
    },
    submitText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
  });
