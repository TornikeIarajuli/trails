import { Stack } from 'expo-router';
import { useColors } from '../../../constants/colors';

// The notification list is always the bottom of this stack, so Back from anything
// opened here (badges, preferences) — or pushed on top by a push notification — lands on it.
export const unstable_settings = {
  anchor: 'index',
};

export default function AlertsLayout() {
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
      <Stack.Screen name="badges" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
