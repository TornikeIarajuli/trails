import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useSignup } from '../../hooks/useAuth';

export default function SignupScreen() {
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
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    signup.mutate(
      { email, password, username, full_name: fullName || undefined },
      {
        onError: (error: any) => {
          Alert.alert(
            'Signup Failed',
            error.response?.data?.message || 'Could not create account',
          );
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
            placeholder="Min 6 characters"
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

const styles = StyleSheet.create({
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
