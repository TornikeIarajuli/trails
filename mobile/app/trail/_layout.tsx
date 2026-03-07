import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../constants/colors';

export default function TrailLayout() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600', color: Colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        // Fix back button overlapping status bar in edge-to-edge mode
        headerStatusBarHeight: insets.top,
      } as any}
    >
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="[id]/hike" />
      <Stack.Screen name="[id]/photos" />
      <Stack.Screen name="[id]/conditions" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="user/followers" />
      <Stack.Screen name="completion/[id]" />
      <Stack.Screen name="[id]/events" />
      <Stack.Screen name="[id]/event/[eventId]/index" />
    </Stack>
  );
}
