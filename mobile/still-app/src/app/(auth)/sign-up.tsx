import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/authStore';

export default function SignUpScreen() {
  const { signUp, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    setError('');
    if (!email || !password || !username) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      await signUp(email, password, username);
      router.push('/(main)');
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Ionicons name="logo-apple" size={48} color="#1E34E8" />
            <Text style={styles.appTitle}>STILL</Text>
            <Text style={styles.subtitle}>Objects for living / Vol. 01</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create account</Text>
            <Text style={styles.cardSub}>New accounts start as a customer.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="atelier"
              />
            </View>

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
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create account'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity style={styles.footerLink} onPress={() => router.back()}>
              <Text style={styles.footerLinkText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  appTitle: { fontFamily: 'Instrument Serif', fontSize: 34, fontWeight: '400', color: '#101210', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6C6E64', marginTop: 4 },
  card: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 12, padding: 24, marginBottom: 24 },
  cardTitle: { fontFamily: 'Instrument Serif', fontSize: 28, color: '#101210', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#6C6E64', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontFamily: 'IBM Plex Mono', fontSize: 10, letterSpacing: 0.14, textTransform: 'uppercase', color: '#6C6E64', marginBottom: 7 },
  input: { width: '100%', padding: 12, borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, backgroundColor: '#FFFDF8', fontSize: 15, color: '#101210', fontFamily: 'Inter' },
  error: { color: '#A62A1E', fontSize: 13, marginBottom: 12 },
  button: { width: '100%', padding: 13, borderWidth: 1, borderColor: '#101210', backgroundColor: '#101210', borderRadius: 6, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase', color: '#FFFDF8' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  footerText: { fontSize: 13, color: '#6C6E64' },
  footerLink: { marginLeft: 4 },
  footerLinkText: { fontSize: 13, color: '#1E34E8', fontWeight: '600' },
};
