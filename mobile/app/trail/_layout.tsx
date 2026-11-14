import { Stack } from 'expo-router';
import { useColors } from '../../constants/colors';

export default function TrailLayout() {
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
        // The app draws edge to edge (status bar translucent). Saying so makes the native
        // header pad itself by the status bar height; without it the header can start under
        // the clock. (`headerStatusBarHeight`, used here before, is a JS-stack option and
        // native-stack ignores it.)
        statusBarTranslucent: true,
      }}
    >
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="[id]/hike" />
      <Stack.Screen name="[id]/photos" />
      <Stack.Screen name="[id]/conditions" />
      <Stack.Screen name="[id]/gear" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="user/followers" />
      <Stack.Screen name="user/regions" />
      <Stack.Screen name="bookmarks" />
      <Stack.Screen name="recommendations" />
      <Stack.Screen name="completion/[id]" />
      <Stack.Screen name="[id]/events" />
      <Stack.Screen name="[id]/event/[eventId]/index" />
    </Stack>
  );
}
