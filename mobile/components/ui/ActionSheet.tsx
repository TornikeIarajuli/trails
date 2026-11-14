import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from './Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { Sheet, SheetButton, useSheet } from './Sheet';

type IoniconsName = React.ComponentProps<typeof Icon>['name'];

export interface ActionSheetOption {
  key: string;
  label: string;
  icon?: IoniconsName;
  destructive?: boolean;
  selected?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  onSelect: (key: string) => void;
  /** Called once the sheet has closed: Cancel, backdrop, swipe down or the back button. */
  onClose: () => void;
  /** Replaces the options with a spinner while a choice is being carried out. */
  loading?: boolean;
  cancelLabel?: string;
  /**
   * Every choice ends the sheet: it animates out first and `onSelect` runs after.
   * Without it the sheet stays open and `onSelect` decides what comes next.
   */
  closeOnSelect?: boolean;
}

/**
 * Bottom sheet with a list of choices. Used where `Alert.alert` cannot be:
 * Android alerts show at most three buttons.
 */
export function ActionSheet({
  visible,
  title,
  message,
  options,
  onSelect,
  onClose,
  loading = false,
  cancelLabel = 'Cancel',
  closeOnSelect = false,
}: ActionSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      showCloseButton={false}
      closeLabel={cancelLabel}
      dismissible={!loading}
      scrollable={false}
      dragAnywhere
      footer={<CancelButton label={cancelLabel} disabled={loading} />}
    >
      <ActionSheetOptions
        message={message}
        options={options}
        loading={loading}
        onSelect={onSelect}
        closeOnSelect={closeOnSelect}
      />
    </Sheet>
  );
}

function CancelButton({ label, disabled }: { label: string; disabled: boolean }) {
  const sheet = useSheet();
  return <SheetButton title={label} variant="secondary" disabled={disabled} onPress={() => sheet.dismiss()} />;
}

function ActionSheetOptions({
  message,
  options,
  loading,
  onSelect,
  closeOnSelect,
}: Pick<ActionSheetProps, 'message' | 'options' | 'onSelect'> & { loading: boolean; closeOnSelect: boolean }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const sheet = useSheet();

  const choose = (key: string) => {
    if (closeOnSelect) sheet.dismiss(() => onSelect(key));
    else onSelect(key);
  };

  return (
    <View>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : (
        options.map((option, index) => {
          const color = option.destructive ? Colors.error : Colors.text;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.option, index === options.length - 1 && styles.optionLast]}
              onPress={() => choose(option.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: !!option.selected }}
            >
              {option.icon ? <Icon name={option.icon} size={20} color={color} /> : null}
              <Text style={[styles.optionLabel, { color }]}>{option.label}</Text>
              {option.selected ? <Icon name="checkmark" size={20} color={Colors.primary} /> : null}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      marginBottom: 8,
    },
    loading: {
      paddingVertical: 24,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 50,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    optionLast: {
      borderBottomWidth: 0,
    },
    optionLabel: {
      flex: 1,
      fontSize: 16,
    },
  });
