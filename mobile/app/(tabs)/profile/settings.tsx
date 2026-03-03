import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useSettingsStore } from '../../../store/settingsStore';
import { logout } from '../../../hooks/useAuth';
import api from '../../../services/api';

export default function SettingsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const toggleDarkMode = useSettingsStore((s) => s.toggleDarkMode);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Type DELETE to confirm — your hikes, badges, and profile will be gone forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete my account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.delete('/users/me');
                      await logout();
                    } catch {
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="moon-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="language-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Show Georgian names</Text>
            </View>
            <Switch
              value={language === 'ka'}
              onValueChange={(val) => setLanguage(val ? 'ka' : 'en')}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/(tabs)/profile/notifications')}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Notification Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/(tabs)/profile/notification-preferences')}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="options-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Notification Preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Alert.alert(
              'Emergency Contact',
              'To set an emergency contact, search for a user from their profile page and select "Set as Emergency Contact".',
            )}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
              <Text style={styles.rowLabel}>Emergency Contact</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.logoutRow} onPress={logout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.deleteRow} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color={Colors.error} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Mikiri Trails v1.0.0</Text>
      </View>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
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
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
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
    divider: {
      height: 1,
      backgroundColor: Colors.borderLight,
      marginVertical: 12,
    },
    deleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    deleteText: {
      fontSize: 16,
      color: Colors.error,
      fontWeight: '600',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    version: {
      textAlign: 'center',
      color: Colors.textLight,
      fontSize: 13,
      marginTop: 'auto',
      paddingBottom: 20,
    },
  });
