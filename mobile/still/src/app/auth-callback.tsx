import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Cold-start fallback for the Google OAuth redirect. The in-app flow handles
 * the redirect inside signInWithGoogle(); this route covers the case where
 * Android launches the app directly from stillapp://auth-callback.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    access_token?: string | string[];
    refresh_token?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const finish = async () => {
      const oauthError = first(params.error_description) || first(params.error);
      if (oauthError) {
        router.replace('/sign-in');
        return;
      }

      const code = first(params.code);
      const accessToken = first(params.access_token);
      const refreshToken = first(params.refresh_token);

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          router.replace('/sign-in');
          return;
        }

        await useAuth.getState().fetchProfile();
        router.replace(useAuth.getState().user ? '/' : '/sign-in');
      } catch {
        router.replace('/sign-in');
      }
    };

    finish();
  }, [
    params.access_token,
    params.code,
    params.error,
    params.error_description,
    params.refresh_token,
    router,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.wordmark}>STILL</Text>
        <ActivityIndicator color="#1E34E8" />
        <Text style={styles.caption}>Completing sign-in…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  wordmark: { fontFamily: 'serif', fontSize: 34, letterSpacing: 5, color: '#101210' },
  caption: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#6C6E64',
    textTransform: 'uppercase',
  },
});
