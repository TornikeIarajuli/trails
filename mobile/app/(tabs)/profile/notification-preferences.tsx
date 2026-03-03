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
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from '../../../hooks/useNotifications';
import { NotificationPreferences } from '../../../services/notifications';

const PREF_ROWS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
}[] = [
  {
    key: 'new_follower',
    label: 'New Followers',
    description: 'When someone follows you',
    icon: 'person-add',
    color: '#3B82F6',
    bg: '#DBEAFE',
  },
  {
    key: 'badge_earned',
    label: 'Badge Earned',
    description: 'When you unlock a new badge',
    icon: 'medal',
    color: '#F59E0B',
    bg: '#FEF3C7',
  },
  {
    key: 'completion_approved',
    label: 'Completion Approved',
    description: 'When your hike is approved by an admin',
    icon: 'checkmark-circle',
    color: '#16A34A',
    bg: '#DCFCE7',
  },
  {
    key: 'event_invite',
    label: 'Event Invites',
    description: 'When someone invites you to a group hike',
    icon: 'calendar',
    color: '#8B5CF6',
    bg: '#EDE9FE',
  },
  {
    key: 'trail_condition',
    label: 'Trail Conditions',
    description: 'Updates about trail closures or conditions',
    icon: 'warning',
    color: '#D97706',
    bg: '#FEF3C7',
  },
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>
          Choose which push notifications you want to receive.
        </Text>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
        ) : (
          <View style={styles.section}>
            {PREF_ROWS.map((row, i) => {
              const enabled = prefs?.[row.key] ?? true;
              return (
                <View
                  key={row.key}
                  style={[styles.row, i < PREF_ROWS.length - 1 && styles.rowBorder]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: row.bg }]}>
                    <Ionicons name={row.icon as any} size={20} color={row.color} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowDesc}>{row.description}</Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggle(row.key)}
                    trackColor={{ true: Colors.accent, false: Colors.border }}
                    thumbColor={Colors.surface}
                    disabled={updatePrefs.isPending}
                  />
                </View>
              );
            })}
          </View>
        )}
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
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    hint: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    section: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: 15,
      color: Colors.text,
      fontWeight: '600',
    },
    rowDesc: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 17,
    },
  });
