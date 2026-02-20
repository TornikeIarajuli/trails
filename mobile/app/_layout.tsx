import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useColors } from '../constants/colors';
import { useNotificationSetup } from '../hooks/useNotifications';

try {
  SplashScreen.preventAutoHideAsync();
} catch {}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
});

function RootLayoutInner() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const Colors = useColors();

  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useNotificationSetup();

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
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary onError={() => setHasError(true)}>
        <RootLayoutInner />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

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
