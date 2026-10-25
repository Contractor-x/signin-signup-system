import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AUTH_DEMO } from '@/services/supabase';
import { useAuth } from '@/store/authStore';

SplashScreen.setOptions({ duration: 500, fade: true });

export default function RootLayout() {
  const fetchProfile = useAuth((state) => state.fetchProfile);

  useEffect(() => {
    if (!AUTH_DEMO) {
      fetchProfile().catch(() => {
        // A missing/expired session is handled by the auth screens.
      });
    }
  }, [fetchProfile]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack id="root-stack" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F2EFE7' } }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="receipt" options={{ gestureEnabled: false }} />
        <Stack.Screen name="orders/[id]" />
        <Stack.Screen name="seller" />
        <Stack.Screen name="admin" />
      </Stack>
    </SafeAreaProvider>
  );
}
