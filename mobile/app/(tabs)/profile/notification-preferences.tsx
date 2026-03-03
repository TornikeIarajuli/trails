import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from '../../../hooks/useNotifications';
import { NotificationPreferences } from '../../../services/notifications';

const PREF_ROWS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'new_follower',        label: 'New Followers',          description: 'When someone follows you' },
  { key: 'badge_earned',        label: 'Badge Earned',           description: 'When you unlock a new badge' },
  { key: 'completion_approved', label: 'Completion Approved',    description: 'When your hike is approved by an admin' },
  { key: 'event_invite',        label: 'Event Invites',          description: 'When someone invites you to a group hike' },
  { key: 'trail_condition',     label: 'Trail Conditions',       description: 'Updates about trail closures or conditions' },
];

export default function NotificationPreferencesScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { data: prefs, isLoading } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();

  const toggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    updatePrefs.mutate({ [key]: !prefs[key] });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notification Preferences',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Push Notifications</Text>
            {PREF_ROWS.map((row, i) => (
              <View
                key={row.key}
                style={[styles.row, i < PREF_ROWS.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowDesc}>{row.description}</Text>
                </View>
                <Switch
                  value={prefs?.[row.key] ?? true}
                  onValueChange={() => toggle(row.key)}
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                  thumbColor={Colors.surface}
                  disabled={updatePrefs.isPending}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      padding: 16,
    },
    section: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    rowLeft: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: 16,
      color: Colors.text,
      fontWeight: '500',
    },
    rowDesc: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
  });
