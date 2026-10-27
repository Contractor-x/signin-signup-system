import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/authStore';
import { AUTH_DEMO } from '@/services/supabase';
import { DEMO_ACCOUNTS } from '@/data/demo';

export default function SignInScreen() {
  const { signIn, signInWithGoogle, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      if (useAuth.getState().user) router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.wordmarkRow}>
            <Text style={styles.appTitle}>STILL</Text>
            <Text style={styles.registered}>®</Text>
          </View>
          <Text style={styles.subtitle}>OBJECTS FOR LIVING / VOL. 01</Text>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Welcome back</Text>
            <Text style={styles.cardTitle}>Sign in</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#A8A294"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                placeholder="••••••••"
                placeholderTextColor="#A8A294"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFDF8" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogle}
              disabled={googleLoading}
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.googleButtonText}>
                Continue with Google{AUTH_DEMO ? ' (demo)' : ''}
              </Text>
            </TouchableOpacity>

          </View>

          {AUTH_DEMO ? (
            <View style={styles.demoCard}>
              <Text style={styles.demoTitle}>Quick sandbox sign-in</Text>
              {DEMO_ACCOUNTS.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={styles.demoRow}
                  onPress={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    signIn(account.email, account.password)
                      .then(() => router.replace('/'))
                      .catch((err: any) => setError(err.message));
                  }}
                >
                  <View>
                    <Text style={styles.demoEmail}>{account.email}</Text>
                    <Text style={styles.demoRole}>{account.role.replace(/_/g, ' ')}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color="#1E34E8" />
                </TouchableOpacity>
              ))}
                            <Text style={styles.demoHint}>
                Auth is running in local demo mode. Add a real Supabase key and set EXPO_PUBLIC_AUTH_DEMO=false to use live accounts.
              </Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to STILL? </Text>
            <TouchableOpacity onPress={() => router.push('/sign-up')}>
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.guestLink} onPress={() => router.replace('/')}>
            <Text style={styles.guestLinkText}>Continue browsing as a guest</Text>
          </TouchableOpacity>

          <Text style={styles.credit}>By Umusa</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' as const },
  wordmarkRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, justifyContent: 'center' as const },
  appTitle: { fontFamily: 'serif', fontSize: 40, letterSpacing: 5, color: '#101210' },
  registered: { fontSize: 12, color: '#1E34E8', marginTop: 12, marginLeft: 2 },
  subtitle: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 2, color: '#6C6E64', textAlign: 'center' as const, marginTop: 4, marginBottom: 26 },
  card: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 12, padding: 22, marginBottom: 16 },
  cardEyebrow: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1.6, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 2 },
  cardTitle: { fontFamily: 'serif', fontSize: 30, color: '#101210', marginBottom: 18 },
  field: { marginBottom: 14 },
  label: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, backgroundColor: '#FFFDF8', paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#101210' },
  error: { color: '#A62A1E', fontSize: 12, marginBottom: 10 },
  button: { backgroundColor: '#101210', borderRadius: 6, paddingVertical: 14, alignItems: 'center' as const, marginTop: 2 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  dividerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#D8D2C4' },
  dividerText: { fontFamily: 'monospace', fontSize: 9, color: '#6C6E64' },
  googleButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, borderWidth: 1, borderColor: '#A8A294', backgroundColor: '#FFFDF8', borderRadius: 6, paddingVertical: 13 },
  googleButtonText: { fontSize: 12, color: '#101210', fontWeight: '500' as const },
  demoCard: { backgroundColor: '#ECE8DC', borderRadius: 10, padding: 14, marginBottom: 18 },
  demoTitle: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 6 },
  demoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#D8D2C4' },
  demoEmail: { fontFamily: 'monospace', fontSize: 11, color: '#101210' },
  demoRole: { fontFamily: 'monospace', fontSize: 8, color: '#6C6E64', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 1 },
  demoHint: { fontSize: 9, color: '#6C6E64', lineHeight: 14, marginTop: 8 },
  footer: { flexDirection: 'row' as const, justifyContent: 'center' as const, marginBottom: 10 },
  footerText: { fontSize: 12, color: '#6C6E64' },
  footerLink: { fontSize: 12, color: '#1E34E8', fontWeight: '600' as const },
  guestLink: { alignItems: 'center' as const, paddingVertical: 8 },
  guestLinkText: { fontFamily: 'monospace', fontSize: 10, color: '#6C6E64', textDecorationLine: 'underline' as const },
  credit: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, color: '#6C6E64', opacity: 0.55, textAlign: 'center' as const, marginTop: 14 },
};
