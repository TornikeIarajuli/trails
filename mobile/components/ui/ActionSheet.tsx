import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

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
  onClose: () => void;
  /** Replaces the options with a spinner while a choice is being carried out. */
  loading?: boolean;
  cancelLabel?: string;
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
}: ActionSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {loading ? (
            <ActivityIndicator style={styles.loading} color={Colors.primary} />
          ) : (
            options.map((option) => {
              const color = option.destructive ? Colors.error : Colors.text;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.option}
                  onPress={() => onSelect(option.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: !!option.selected }}
                >
                  {option.icon ? <Ionicons name={option.icon} size={20} color={color} /> : null}
                  <Text style={[styles.optionLabel, { color }]}>{option.label}</Text>
                  {option.selected ? (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={styles.cancel}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 4,
    },
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
    optionLabel: {
      flex: 1,
      fontSize: 16,
    },
    cancel: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    cancelLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
  });
