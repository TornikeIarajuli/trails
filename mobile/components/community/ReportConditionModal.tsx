import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useReportCondition } from '../../hooks/useCommunity';
import { ConditionType, SeverityLevel } from '../../types/community';

interface ReportConditionModalProps {
  trailId: string;
  visible: boolean;
  onClose: () => void;
}

const CONDITIONS: { type: ConditionType; label: string; icon: string }[] = [
  { type: 'trail_clear', label: 'Trail Clear', icon: 'checkmark-circle' },
  { type: 'muddy', label: 'Muddy', icon: 'water' },
  { type: 'snow', label: 'Snow', icon: 'snow' },
  { type: 'fallen_tree', label: 'Fallen Tree', icon: 'leaf' },
  { type: 'flooded', label: 'Flooded', icon: 'rainy' },
  { type: 'overgrown', label: 'Overgrown', icon: 'flower' },
  { type: 'damaged', label: 'Damaged', icon: 'construct' },
  { type: 'closed', label: 'Closed', icon: 'close-circle' },
];

const SEVERITIES: { level: SeverityLevel; label: string; color: string }[] = [
  { level: 'info', label: 'Info', color: '#2196F3' },
  { level: 'warning', label: 'Warning', color: '#FF9800' },
  { level: 'danger', label: 'Danger', color: '#F44336' },
];

export function ReportConditionModal({
  trailId,
  visible,
  onClose,
}: ReportConditionModalProps) {
  const [conditionType, setConditionType] = useState<ConditionType | null>(null);
  const [severity, setSeverity] = useState<SeverityLevel>('info');
  const [description, setDescription] = useState('');
  const reportMutation = useReportCondition();

  const handleSubmit = () => {
    if (!conditionType) {
      Alert.alert('Select a condition type');
      return;
    }

    reportMutation.mutate(
      {
        trail_id: trailId,
        condition_type: conditionType,
        severity,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          setConditionType(null);
          setSeverity('info');
          setDescription('');
          onClose();
        },
        onError: () => {
          Alert.alert('Error', 'Failed to submit report');
        },
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Report Condition</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Condition Type</Text>
            <View style={styles.chipGrid}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c.type}
                  style={[
                    styles.chip,
                    conditionType === c.type && styles.chipActive,
                  ]}
                  onPress={() => setConditionType(c.type)}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={16}
                    color={conditionType === c.type ? Colors.textOnPrimary : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      conditionType === c.type && styles.chipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Severity</Text>
            <View style={styles.severityRow}>
              {SEVERITIES.map((s) => (
                <TouchableOpacity
                  key={s.level}
                  style={[
                    styles.severityChip,
                    severity === s.level && { backgroundColor: s.color },
                  ]}
                  onPress={() => setSeverity(s.level)}
                >
                  <Text
                    style={[
                      styles.severityText,
                      severity === s.level && styles.severityTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Description (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Describe the condition..."
              placeholderTextColor={Colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, !conditionType && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!conditionType || reportMutation.isPending}
          >
            <Text style={styles.submitText}>
              {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.textOnPrimary,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  severityText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  severityTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
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
