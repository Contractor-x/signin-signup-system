import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AUTH_DEMO } from '@/services/supabase';
import { useAuth } from '@/store/authStore';

export default function ProfileScreen() {
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/sign-in');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
          <Text style={styles.headerSub}>Profile, orders and sandbox tools</Text>
        </View>

        {user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.username}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{user.role.replace(/_/g, ' ')}</Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.signInCard} onPress={() => router.push('/sign-in')}>
            <View style={styles.avatarGhost}>
              <Ionicons name="person-outline" size={26} color="#6C6E64" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Guest</Text>
              <Text style={styles.profileEmail}>Sign in to save orders and check out faster.</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#1E34E8" />
          </TouchableOpacity>
        )}

        <View style={styles.menuCard}>
          <MenuItem icon="receipt-outline" label="Orders & receipts" onPress={() => router.push('/orders')} />
          <MenuItem icon="bag-handle-outline" label="Your bag" onPress={() => router.push('/cart')} />
          {user && user.role !== 'customer' ? (
            <MenuItem icon="storefront-outline" label="Seller dashboard" onPress={() => router.push('/seller')} />
          ) : null}
          {user?.role === 'superuser' ? (
            <MenuItem icon="shield-checkmark-outline" label="Admin dashboard" onPress={() => router.push('/admin')} />
          ) : null}
          {!user ? (
            <MenuItem icon="log-in-outline" label="Sign in / Create account" onPress={() => router.push('/sign-in')} />
          ) : (
            <MenuItem icon="log-out-outline" label="Sign out" danger onPress={handleSignOut} last />
          )}
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Build</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Mode</Text>
            <Text style={styles.metaValue}>{AUTH_DEMO ? 'Local sandbox' : 'Supabase auth'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Payments</Text>
            <Text style={styles.metaValue}>Sandbox / test only</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Version</Text>
            <Text style={styles.metaValue}>1.0.0 (1)</Text>
          </View>
        </View>

        {AUTH_DEMO ? (
          <View style={styles.demoCard}>
            <Text style={styles.demoTitle}>Demo accounts</Text>
            <Text style={styles.demoText}>Owner · admin@still.local / Admin1234!</Text>
            <Text style={styles.demoText}>Superuser · superuser@still.local / Super1234!</Text>
            <Text style={styles.demoText}>Customer · customer@still.local / Customer1234!</Text>
            <Text style={styles.demoHint}>
              Auth is running in local demo mode. Add a real Supabase key and set EXPO_PUBLIC_AUTH_DEMO=false to use live accounts.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, last && styles.menuItemLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={20} color={danger ? '#A62A1E' : '#101210'} />
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#CBC5B7" />
    </TouchableOpacity>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  scrollContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 30 },
  header: { marginBottom: 16 },
  headerTitle: { fontFamily: 'serif', fontSize: 30, color: '#101210' },
  headerSub: { fontSize: 12, color: '#6C6E64', marginTop: 2 },
  profileCard: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 10, padding: 16, marginBottom: 14 },
  signInCard: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#E6F4FE', borderWidth: 1, borderColor: '#BBDEFB', borderRadius: 10, padding: 16, marginBottom: 14, gap: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#101210', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 14 },
  avatarGhost: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', alignItems: 'center' as const, justifyContent: 'center' as const },
  avatarText: { fontFamily: 'serif', fontSize: 26, color: '#FFFDF8' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '600' as const, color: '#101210', textTransform: 'capitalize' as const },
  profileEmail: { fontSize: 11, color: '#6C6E64', marginTop: 2 },
  rolePill: { alignSelf: 'flex-start' as const, backgroundColor: '#ECE8DC', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, marginTop: 6 },
  roleText: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#34372F' },
  menuCard: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 10, paddingHorizontal: 16, marginBottom: 14 },
  menuItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E6E1D5' },
  menuItemLast: { borderBottomWidth: 0 },
  menuLabel: { flex: 1, fontSize: 14, color: '#101210', fontWeight: '500' as const },
  menuLabelDanger: { color: '#A62A1E' },
  metaCard: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 10, padding: 16, marginBottom: 14 },
  metaTitle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 10 },
  metaRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 5 },
  metaKey: { fontSize: 12, color: '#6C6E64' },
  metaValue: { fontSize: 12, fontFamily: 'monospace', color: '#34372F' },
  demoCard: { backgroundColor: '#ECE8DC', borderRadius: 10, padding: 16 },
  demoTitle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 8 },
  demoText: { fontFamily: 'monospace', fontSize: 10, color: '#34372F', marginBottom: 4 },
  demoHint: { fontSize: 10, color: '#6C6E64', marginTop: 8, lineHeight: 15 },
};
