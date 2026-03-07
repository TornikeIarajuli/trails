import '../utils/locationTask'; // Register background GPS task before app mounts
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider } from 'posthog-react-native';
import { initAnalytics } from '../utils/analytics';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryPersister } from '../utils/queryPersister';
import { queryClient } from '../utils/queryClient';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useColors } from '../constants/colors';
import { useNotificationSetup } from '../hooks/useNotifications';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { useHeartbeat } from '../hooks/useHeartbeat';

try {
  SplashScreen.preventAutoHideAsync();
} catch {}


function RootLayoutInner() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const Colors = useColors();

  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useNotificationSetup();
  useNetworkSync();
  useHeartbeat();

  useEffect(() => {
    Promise.all([restoreSession(), hydrateSettings()]).finally(() => {
      try { SplashScreen.hideAsync(); } catch {}
    });
  }, []);

  if (isLoading) return null;

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trail" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ title: 'Find Users', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

function RootLayout() {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
          Something went wrong
        </Text>
        <TouchableOpacity
          onPress={() => setHasError(false)}
          style={{ backgroundColor: '#A0522D', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <PostHogProvider client={initAnalytics()} autocapture>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000 }}
      >
        <ErrorBoundary onError={() => setHasError(true)}>
          <RootLayoutInner />
        </ErrorBoundary>
      </PersistQueryClientProvider>
    </PostHogProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default RootLayout;
