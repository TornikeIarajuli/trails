import { Stack } from 'expo-router';

export default function TrailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="[id]/hike" />
      <Stack.Screen name="[id]/photos" />
      <Stack.Screen name="[id]/conditions" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="user/followers" />
      <Stack.Screen name="completion/[id]" />
    </Stack>
  );
}
