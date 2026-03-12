import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, ActivityIndicator, Share } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useSettingsStore, GpsAccuracy } from '../../../store/settingsStore';
import { logout } from '../../../hooks/useAuth';
import { usersService } from '../../../services/users';

const GPS_OPTIONS: { value: GpsAccuracy; label: string; hint: string }[] = [
  { value: 'low', label: 'Battery Saver', hint: '~50m accuracy, 30s interval' },
  { value: 'balanced', label: 'Balanced', hint: '~20m accuracy, 10s interval' },
  { value: 'high', label: 'High Precision', hint: '~5m accuracy, 3s interval' },
];

export default function SettingsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const toggleDarkMode = useSettingsStore((s) => s.toggleDarkMode);
  const gpsAccuracy = useSettingsStore((s) => s.gpsAccuracy);
  const setGpsAccuracy = useSettingsStore((s) => s.setGpsAccuracy);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await usersService.exportMyData();
      const json = JSON.stringify(data, null, 2);
      await Share.share({
        message: json,
        title: 'My Trail Data Export',
      });
    } catch {
      Alert.alert('Error', 'Failed to export your data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

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
              'Your hikes, badges, and profile will be gone forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete my account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await usersService.deleteAccount();
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.sectionTitle}>GPS Accuracy</Text>
          <Text style={styles.sectionHint}>
            Higher accuracy uses more battery during hikes
          </Text>
          {GPS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.radioRow}
              onPress={() => setGpsAccuracy(opt.value)}
              activeOpacity={0.7}
            >
              <View style={styles.radioOuter}>
                {gpsAccuracy === opt.value && <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} />}
              </View>
              <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>{opt.label}</Text>
                <Text style={styles.radioHint}>{opt.hint}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/(tabs)/profile/notifications')}
            activeOpacity={0.7}
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
            activeOpacity={0.7}
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
            activeOpacity={0.7}
            onPress={() => Alert.alert(
              'Emergency Contact',
              'To set an emergency contact, find a user on their profile page and select "Set as Emergency Contact".',
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
          <Text style={styles.sectionTitle}>Data & Privacy</Text>
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={handleExportData}
            disabled={isExporting}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="download-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Export My Data</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.actionRow} onPress={logout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
            <Text style={styles.actionText}>Log Out</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={22} color={Colors.error} />
            <Text style={styles.actionText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/profile/privacy')}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/profile/terms')}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="document-text-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>GZA Trails v1.0.0</Text>
      </ScrollView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    container: {
      padding: 16,
      paddingBottom: 40,
    },
    section: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 14,
    },
    sectionHint: {
      fontSize: 12,
      color: Colors.textLight,
      marginBottom: 12,
      marginTop: -8,
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
      flex: 1,
    },
    rowLabel: {
      fontSize: 16,
      color: Colors.text,
    },
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    radioContent: { flex: 1 },
    radioLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
    radioHint: { fontSize: 12, color: Colors.textLight, marginTop: 1 },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 2,
    },
    actionText: {
      fontSize: 16,
      color: Colors.error,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: Colors.borderLight,
      marginVertical: 12,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    version: {
      textAlign: 'center',
      color: Colors.textLight,
      fontSize: 13,
      marginTop: 8,
    },
  });
