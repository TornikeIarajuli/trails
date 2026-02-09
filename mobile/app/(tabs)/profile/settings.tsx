import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { useSettingsStore } from '../../../store/settingsStore';
import { useLogout } from '../../../hooks/useAuth';

export default function SettingsScreen() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const logout = useLogout();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Show Georgian names</Text>
            <Switch
              value={language === 'ka'}
              onValueChange={(val) => setLanguage(val ? 'ka' : 'en')}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.logoutRow} onPress={logout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Mikiri Trails v1.0.0</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: 13,
    marginTop: 'auto',
    paddingBottom: 20,
  },
});
