import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/auth';

export default function VerifyEmailScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await authService.resendVerification(email);
      setResent(true);
    } catch {
      Alert.alert('Error', 'Could not resend email. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="mail-outline" size={64} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>
        We sent a verification link to{'\n'}
        <Text style={styles.email}>{email}</Text>
      </Text>
      <Text style={styles.hint}>
        Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
      </Text>

      {resent ? (
        <View style={styles.resentBanner}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.resentText}>Email resent successfully</Text>
        </View>
      ) : (
        <Button
          title="Resend email"
          onPress={handleResend}
          loading={resending}
          variant="outline"
        />
      )}

      <TouchableOpacity
        style={styles.backLink}
        onPress={() => router.replace('/(auth)/login')}
      >
        <Text style={styles.backText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    iconWrapper: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: Colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: Colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    body: {
      fontSize: 16,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 12,
    },
    email: {
      fontWeight: '700',
      color: Colors.text,
    },
    hint: {
      fontSize: 14,
      color: Colors.textLight,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 32,
    },
    resentBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: Colors.success + '18',
      borderRadius: 10,
      marginBottom: 8,
    },
    resentText: {
      fontSize: 14,
      color: Colors.success,
      fontWeight: '600',
    },
    backLink: {
      marginTop: 24,
      paddingVertical: 8,
    },
    backText: {
      fontSize: 15,
      color: Colors.primary,
      fontWeight: '600',
    },
  });
