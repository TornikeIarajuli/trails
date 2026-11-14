import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Icon } from '../../components/ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { validatePassword } from '../../utils/passwordRules';
import {
  isRecoveryLinkUsed,
  isResetPasswordUrl,
  markRecoveryLinkSeen,
  markRecoveryLinkUsed,
  parseRecoveryLink,
} from '../../utils/recoveryLink';
import { getErrorMessage, getErrorStatus } from '../../utils/showError';
import { withBottomInset } from '../../utils/insets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Opened by the link in the password-reset e-mail (`mikiri-trails://reset-password#…`). */
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  // The latest reset link wins; any other link that arrives later leaves it in place
  const linkingUrl = Linking.useLinkingURL();
  const [resetUrl, setResetUrl] = useState<string | null>(() =>
    isResetPasswordUrl(linkingUrl) ? linkingUrl : null,
  );
  const [unusable, setUnusable] = useState(() => isRecoveryLinkUsed(resetUrl));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Shown: launching the app again later must not open this screen for it again
  useEffect(() => {
    markRecoveryLinkSeen(resetUrl);
  }, [resetUrl]);

  useEffect(() => {
    if (!isResetPasswordUrl(linkingUrl) || linkingUrl === resetUrl) return;
    setResetUrl(linkingUrl);
    setUnusable(isRecoveryLinkUsed(linkingUrl));
    setPassword('');
    setConfirmation('');
    setErrorMsg('');
    setDone(false);
  }, [linkingUrl]);

  const link = useMemo(() => parseRecoveryLink(resetUrl), [resetUrl]);
  const recovery = !unusable && link?.kind === 'recovery' ? link : null;

  const leaveTo = (href: '/(auth)/login' | '/(auth)/forgot-password') => {
    router.replace(href);
  };

  const handleSubmit = async () => {
    if (!recovery) return;
    setErrorMsg('');
    const problem = validatePassword(password);
    if (problem) {
      setErrorMsg(problem);
      return;
    }
    if (password !== confirmation) {
      setErrorMsg('The two passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await authService.updatePassword(recovery.accessToken, password);
      markRecoveryLinkUsed(resetUrl);
      // Changing the password ends the other sessions of the account on the server,
      // including one this phone may still hold, so sign in again with the new one.
      if (useAuthStore.getState().isAuthenticated) useAuthStore.getState().clearSession();
      setDone(true);
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 401 || status === 403) {
        markRecoveryLinkUsed(resetUrl);
        setUnusable(true);
      } else {
        setErrorMsg(getErrorMessage(error, 'Could not update the password. Please try again.'));
      }
    } finally {
      setSaving(false);
    }
  };

  let content: React.ReactNode;
  if (done) {
    content = (
      <View style={styles.centered}>
        <View style={styles.stateIcon}>
          <Icon name="checkmark-circle" size={44} color={Colors.success} />
        </View>
        <Text style={styles.stateTitle}>Password updated</Text>
        <Text style={styles.stateBody}>You can now log in with your new password.</Text>
        <Button title="Log In" onPress={() => leaveTo('/(auth)/login')} style={styles.stateButton} />
      </View>
    );
  } else if (recovery) {
    content = (
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>
            At least 8 characters, with an uppercase letter, a lowercase letter and a number.
          </Text>
        </View>

        <View style={styles.form}>
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Input
            label="New password"
            placeholder="Enter a new password"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
            secureTextEntry
            autoCapitalize="none"
          />
          <Input
            label="Repeat new password"
            placeholder="Enter it again"
            value={confirmation}
            onChangeText={(t) => { setConfirmation(t); setErrorMsg(''); }}
            secureTextEntry
            autoCapitalize="none"
          />

          <Button title="Update Password" onPress={handleSubmit} loading={saving} />
        </View>

        <TouchableOpacity style={styles.backLink} onPress={() => leaveTo('/(auth)/login')}>
          <Text style={styles.backLinkText}>
            Back to <Text style={styles.backLinkBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    content = (
      <View style={styles.centered}>
        <View style={styles.stateIcon}>
          <Icon name="time-outline" size={44} color={Colors.warning} />
        </View>
        <Text style={styles.stateTitle}>This link has expired</Text>
        <Text style={styles.stateBody}>
          Password reset links work once and only for a short time. Request a new one and open it on this phone.
        </Text>
        <Button
          title="Request a New Link"
          onPress={() => leaveTo('/(auth)/forgot-password')}
          style={styles.stateButton}
        />
        <TouchableOpacity style={styles.backLink} onPress={() => leaveTo('/(auth)/login')}>
          <Text style={styles.backLinkText}>
            Back to <Text style={styles.backLinkBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={withBottomInset(styles.scrollContent, insets.bottom)}
        keyboardShouldPersistTaps="handled"
      >
        {content}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    gap: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error + '12',
    borderWidth: 1,
    borderColor: Colors.error + '40',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  backLinkText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  backLinkBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  centered: {
    alignItems: 'center',
  },
  stateIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stateTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  stateButton: {
    alignSelf: 'stretch',
  },
});
