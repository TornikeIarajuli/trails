import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { getErrorMessage, isNetworkError } from '../../utils/showError';

interface ErrorStateProps {
  /** The error of the failed request — picks the icon and the wording. */
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Adds a "Go back" action, for screens that have no header while they are failing. */
  showBack?: boolean;
  /** One-line variant for a section inside a longer screen. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)/home');
  }
}

/**
 * Shown when a request failed and there is nothing cached to show instead.
 * Deliberately looks different from the "nothing here yet" empty states:
 * a red-tinted icon, a "couldn't load" title and a Retry button.
 */
export function ErrorState({
  error,
  title,
  message,
  onRetry,
  retrying = false,
  showBack = false,
  compact = false,
  style,
}: ErrorStateProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const offline = isNetworkError(error);
  const resolvedTitle = title ?? (offline ? 'No connection' : "Couldn't load this");
  const resolvedMessage =
    message ?? getErrorMessage(error, 'Something went wrong on our side. Please try again.');

  if (compact) {
    return (
      <View style={[styles.compact, style]} accessibilityRole="alert">
        <Ionicons
          name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={18}
          color={Colors.error}
        />
        <Text style={styles.compactText} numberOfLines={2}>
          {message ?? resolvedTitle}
        </Text>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            disabled={retrying}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            {retrying ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.compactRetry}>Retry</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <View style={styles.iconCircle}>
        <Ionicons
          name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={36}
          color={Colors.error}
        />
      </View>
      <Text style={styles.title}>{resolvedTitle}</Text>
      <Text style={styles.message}>{resolvedMessage}</Text>

      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          disabled={retrying}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          testID="retry-button"
        >
          {retrying ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={Colors.textOnPrimary} />
              <Text style={styles.retryText}>Retry</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {showBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="back-button"
        >
          <Ionicons name="arrow-back" size={16} color={Colors.primary} />
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
      gap: 8,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.error + '15',
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      textAlign: 'center',
      maxWidth: 300,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minWidth: 140,
      minHeight: 44,
      marginTop: 12,
      paddingHorizontal: 24,
      borderRadius: 22,
      backgroundColor: Colors.primary,
    },
    retryText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      marginTop: 4,
      paddingHorizontal: 16,
    },
    backText: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.primary,
    },
    compact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: Colors.error + '10',
    },
    compactText: {
      flex: 1,
      fontSize: 13,
      color: Colors.text,
    },
    compactRetry: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.primary,
    },
  });
