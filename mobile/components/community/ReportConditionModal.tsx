import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useReportCondition } from '../../hooks/useCommunity';
import { ConditionType, SeverityLevel } from '../../types/community';
import { haptics } from '../../utils/haptics';
import { Sheet, SheetButton, SheetTextInput } from '../ui/Sheet';

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
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [conditionType, setConditionType] = useState<ConditionType | null>(null);
  const [severity, setSeverity] = useState<SeverityLevel>('info');
  const [description, setDescription] = useState('');
  const reportMutation = useReportCondition();
  // A report that was sent starts the next one empty; one that was closed unsent is kept
  const sent = useRef(false);

  useEffect(() => {
    if (!visible || !sent.current) return;
    sent.current = false;
    setConditionType(null);
    setSeverity('info');
    setDescription('');
  }, [visible]);

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
        // Errors are reported by the hook
        onSuccess: () => {
          haptics.success();
          sent.current = true;
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Report Condition"
      closeLabel="Close report form"
      dismissible={!reportMutation.isPending}
      footer={
        <SheetButton
          title="Submit Report"
          onPress={handleSubmit}
          disabled={!conditionType}
          loading={reportMutation.isPending}
        />
      }
    >
      <Text style={[styles.sectionTitle, styles.firstSection]}>Condition Type</Text>
      <View style={styles.chipGrid}>
        {CONDITIONS.map((c) => {
          const selected = conditionType === c.type;
          return (
            <TouchableOpacity
              key={c.type}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => setConditionType(c.type)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Icon
                name={c.icon as any}
                size={16}
                color={selected ? Colors.textOnPrimary : Colors.textSecondary}
              />
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Severity</Text>
      <View style={styles.severityRow}>
        {SEVERITIES.map((s) => {
          const selected = severity === s.level;
          return (
            <TouchableOpacity
              key={s.level}
              style={[styles.severityChip, selected && { backgroundColor: s.color, borderColor: s.color }]}
              onPress={() => setSeverity(s.level)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.severityText, selected && styles.severityTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Description (Optional)</Text>
      <SheetTextInput
        style={styles.input}
        placeholder="Describe the condition..."
        placeholderTextColor={Colors.textLight}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        accessibilityLabel="Description"
      />
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  firstSection: {
    marginTop: 0,
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
    minHeight: 38,
    borderRadius: 20,
    backgroundColor: Colors.background,
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
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.background,
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
});
