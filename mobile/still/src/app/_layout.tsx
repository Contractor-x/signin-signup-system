import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AUTH_DEMO } from '@/services/supabase';
import { useAuth } from '@/store/authStore';

SplashScreen.setOptions({ duration: 300, fade: true });
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fetchProfile = useAuth((state) => state.fetchProfile);

  useEffect(() => {
    // The native splash already carries the bag and the "By Umusa" credit.
    // Keep it up until the first screen has painted, then reveal the shop.
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (AUTH_DEMO) return;
    // Let the first screen paint before restoring/validating the session.
    const timer = setTimeout(() => {
      fetchProfile().catch(() => {
        // A missing/expired session is handled by the auth screens.
      });
    }, 0);
    return () => clearTimeout(timer);
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
