import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Icon } from '../components/ui/Icon';
import { useColors, ColorPalette } from '../constants/colors';

/** Shown for links that match no screen (a stale deep link, a mistyped route). */
export default function NotFoundScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Icon name="compass-outline" size={56} color={Colors.textLight} />
        <Text style={styles.title}>This page doesn't exist</Text>
        <Text style={styles.message}>
          The link you followed may be out of date.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Go to the start screen</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 8,
      backgroundColor: Colors.background,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: Colors.text,
      marginTop: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    button: {
      marginTop: 16,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 24,
      borderRadius: 22,
      backgroundColor: Colors.primary,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
  });
