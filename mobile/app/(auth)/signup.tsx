import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useSignup } from '../../hooks/useAuth';

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already in use') || m.includes('already taken') && m.includes('email')) {
    return 'An account with this email already exists. Try logging in.';
  }
  if (m.includes('username') && m.includes('taken')) {
    return 'That username is already taken. Please choose another.';
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'Please enter a valid email address.';
  }
  if (m.includes('password') && (m.includes('short') || m.includes('least'))) {
    return 'Password must be at least 8 characters.';
  }
  if (m.includes('uppercase') || m.includes('lowercase') || m.includes('number')) {
    return 'Password must contain an uppercase letter, a lowercase letter, and a number.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'No internet connection. Please check your network and try again.';
  }
  return msg;
}

export default function SignupScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const signup = useSignup();

  const handleSignup = () => {
    if (!email || !username || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      Alert.alert('Error', 'Password must contain an uppercase letter, a lowercase letter, and a number');
      return;
    }
    signup.mutate(
      { email, password, username, full_name: fullName || undefined },
      {
        onError: (error: any) => {
          const raw = error.response?.data?.message;
          const message = Array.isArray(raw)
            ? raw[0]
            : (raw ?? 'Could not create account. Please try again.');
          Alert.alert('Signup Failed', friendlyAuthError(message));
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the trail community</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email *"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Username *"
            placeholder="Choose a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Input
            label="Full Name"
            placeholder="Your full name (optional)"
            value={fullName}
            onChangeText={setFullName}
          />
          <Input
            label="Password *"
            placeholder="Min 8 chars, uppercase, number"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button
            title="Create Account"
            onPress={handleSignup}
            loading={signup.isPending}
          />
        </View>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.back()}
        >
          <Text style={styles.loginText}>
            Already have an account?{' '}
            <Text style={styles.loginBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  form: {
    gap: 4,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  loginBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
});
