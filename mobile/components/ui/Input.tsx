import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, secureTextEntry, ...props }: InputProps) {
  const [hidden, setHidden] = useState(true);
  const isPassword = secureTextEntry !== undefined;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error && styles.inputError]}>
        <TextInput
          style={[styles.input, isPassword && styles.inputWithToggle, style]}
          placeholderTextColor={Colors.textLight}
          secureTextEntry={isPassword ? hidden : false}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity style={styles.toggle} onPress={() => setHidden(!hidden)}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
  },
  inputWithToggle: {
    paddingRight: 48,
  },
  toggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  inputError: {
    borderColor: Colors.error,
  },
  error: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
});
