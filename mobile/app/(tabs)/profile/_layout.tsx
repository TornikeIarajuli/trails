import { Stack } from 'expo-router';
import { useColors } from '../../../constants/colors';

// The Profile home is always the bottom of this stack. Screens here are also
// opened from other tabs (bookmarks, notifications…) and from push notifications;
// with the anchor — and `withAnchor` on those links — they get the Profile home
// underneath them instead of being a lone screen with no back button and no tab bar.
export const unstable_settings = {
  anchor: 'index',
};

export default function ProfileLayout() {
  const Colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600', color: Colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="recommendations" />
      <Stack.Screen name="bookmarks" />
      <Stack.Screen name="badges" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="notification-preferences" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="credits" />
      <Stack.Screen name="blocked-users" />
    </Stack>
  );
}
