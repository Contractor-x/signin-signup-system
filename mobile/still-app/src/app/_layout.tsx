import { Stack } from 'expo-router';
import { useAuth } from '@/store/authStore';
import { ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#101210" />;
  }

  return (
    <Stack>
      <Stack.Screen options={{ headerShown: false }} />
    </Stack>
  );
}
