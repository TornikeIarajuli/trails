import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useColors, ColorPalette } from '../constants/colors';
import { useNotificationSetup } from '../hooks/useNotifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: '#1B5E20', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useNotificationSetup();

  useEffect(() => {
    Promise.all([restoreSession(), hydrateSettings()]).finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  if (isLoading) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const createStyles = (Colors: ColorPalette) => ({});

export default RootLayout;
