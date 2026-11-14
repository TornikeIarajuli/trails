import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, ActivityIndicator, Share } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useSettingsStore, GpsAccuracy } from '../../../store/settingsStore';
import { useAuthStore } from '../../../store/authStore';
import { logout } from '../../../hooks/useAuth';
import { usersService } from '../../../services/users';
import { queryKeys } from '../../../utils/queryKeys';
import { getErrorMessage } from '../../../utils/showError';
import { useOfflineMapsStore } from '../../../store/offlineMapsStore';
import { offlineMapsSize } from '../../../services/offlineMaps';
import { formatMegabytes } from '../../../utils/topoTiles';
import { haptics } from '../../../utils/haptics';

const GPS_OPTIONS: { value: GpsAccuracy; label: string; hint: string }[] = [
  { value: 'low', label: 'Battery Saver', hint: 'GPS with fewer updates. Uses the least battery; the recorded track is coarser.' },
  { value: 'balanced', label: 'Standard (recommended)', hint: 'GPS, accurate to about 10 m.' },
  { value: 'high', label: 'High Precision', hint: 'Best accuracy the phone can give. Uses the most battery.' },
];

const APP_NAME = Constants.expoConfig?.name ?? 'GZA';
const APP_VERSION = Constants.expoConfig?.version;

function EmergencyContactRow({ styles, Colors }: { styles: ReturnType<typeof createStyles>; Colors: ColorPalette }) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const contactIdQuery = useQuery<string | null>({
    queryKey: queryKeys.emergencyContact(),
    queryFn: () => usersService.getMyEmergencyContactId(),
    enabled: isAuthenticated,
  });
  const contactId = contactIdQuery.data ?? null;

  const contactQuery = useQuery({
    queryKey: queryKeys.follows.publicProfile(contactId ?? ''),
    queryFn: () => usersService.getPublicProfile(contactId!),
    enabled: !!contactId,
  });

  const removeContact = useMutation({
    mutationFn: () => usersService.setEmergencyContact(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.emergencyContact() }),
    onError: (err) => Alert.alert('Error', getErrorMessage(err, 'Could not remove your emergency contact.')),
  });

  const name = contactQuery.data?.username ? `@${contactQuery.data.username}` : null;
  let subtitle: string;
  if (contactIdQuery.isLoading) subtitle = 'Loading…';
  else if (contactIdQuery.isError) subtitle = "Couldn't load — tap to retry";
  else if (!contactId) subtitle = 'None set';
  else subtitle = name ?? 'Set';

  const onPress = () => {
    if (contactIdQuery.isError) {
      contactIdQuery.refetch();
      return;
    }
    if (!contactId) {
      Alert.alert(
        'Emergency Contact',
        "Choose someone who uses the app: open their profile and tap \"Set as Emergency Contact\". If you send an SOS during a hike, they get a push notification with your location. The app does not contact emergency services — call 112 for that.",
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Find a hiker', onPress: () => router.push('/search') },
        ],
      );
      return;
    }
    Alert.alert('Emergency Contact', `${name ?? 'Your contact'} gets your SOS alerts.`, [
      { text: 'Close', style: 'cancel' },
      { text: 'View profile', onPress: () => router.push(`/trail/user/${contactId}` as any) },
      { text: 'Remove', style: 'destructive', onPress: () => removeContact.mutate() },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.linkRow}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={removeContact.isPending}
      accessibilityRole="button"
      accessibilityLabel={`Emergency contact: ${subtitle}`}
    >
      <View style={styles.rowLeft}>
        <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowLabel}>Emergency Contact</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {removeContact.isPending ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
      )}
    </TouchableOpacity>
  );
}

/** Topo maps on the phone: saved trails plus tiles kept from browsing, with a way to clear them. */
function OfflineMapsRow({ styles, Colors }: { styles: ReturnType<typeof createStyles>; Colors: ColorPalette }) {
  const load = useOfflineMapsStore((s) => s.load);
  const savedCount = useOfflineMapsStore((s) => Object.keys(s.saved).length);
  const downloading = useOfflineMapsStore((s) => s.active !== null);
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    load();
    // Adding up the tile files can take a moment with many of them: after the first frame
    const timer = setTimeout(() => setBytes(offlineMapsSize()), 0);
    return () => clearTimeout(timer);
  }, [load, savedCount, downloading]);

  const hasMaps = savedCount > 0 || (bytes ?? 0) > 0;
  let subtitle: string;
  if (bytes === null) subtitle = 'Checking…';
  else if (!hasMaps) subtitle = 'Nothing saved on this phone';
  else {
    subtitle = `${formatMegabytes(bytes)} on this phone`;
    if (savedCount > 0) subtitle += ` · ${savedCount} trail${savedCount === 1 ? '' : 's'} saved`;
  }
  if (downloading) subtitle += ' · downloading…';

  const confirmDeleteAll = () => {
    Alert.alert(
      'Delete all offline maps?',
      'Topo maps saved for trails, and map tiles kept from browsing, are removed from this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            haptics.tap();
            useOfflineMapsStore.getState().deleteAll();
            setBytes(0);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name="map-outline" size={20} color={Colors.text} />
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowLabel}>Offline maps</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {hasMaps && (
        <TouchableOpacity
          onPress={confirmDeleteAll}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Delete all offline maps"
        >
          <Text style={styles.deleteAllText}>Delete all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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
              accessibilityRole="radio"
              accessibilityState={{ checked: gpsAccuracy === opt.value }}
              accessibilityLabel={`${opt.label}. ${opt.hint}`}
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
          <Text style={styles.sectionTitle}>Maps</Text>
          <OfflineMapsRow styles={styles} Colors={Colors} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.linkRow}
            // The notification centre is the Alerts tab
            onPress={() => router.navigate('/(tabs)/alerts')}
            activeOpacity={0.7}
            accessibilityRole="button"
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
          <EmergencyContactRow styles={styles} Colors={Colors} />
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
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/profile/blocked-users' as any)}
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <Ionicons name="ban-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Blocked users</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
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
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/profile/credits' as any)}
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <Ionicons name="images-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>Data sources & photo credits</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>
          {APP_VERSION ? `${APP_NAME} v${APP_VERSION}` : APP_NAME}
        </Text>
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
    rowTextBlock: {
      flex: 1,
    },
    rowSubtitle: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 1,
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
    deleteAllText: {
      fontSize: 14,
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
