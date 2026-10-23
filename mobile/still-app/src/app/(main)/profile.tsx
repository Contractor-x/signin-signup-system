import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { money } from '@/utils/money';

export default function ProfileScreen() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
          <Text style={styles.headerSub}>Manage your profile</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.profileName}>{user?.username || 'Guest'}</Text>
              <Text style={styles.profileEmail}>{user?.email || '—'}</Text>
              <Text style={styles.profileRole}>
                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem} onPress={() => router.push('/orders')}>
            <Ionicons name="receipt-outline" size={22} color="#101210" />
            <Text style={styles.menuLabel}>Orders</Text>
          </View>

          <View style={styles.menuItem} onPress={() => {}}>
            <Ionicons name="create-outline" size={22} color="#101210" />
            <Text style={styles.menuLabel}>Edit profile</Text>
          </View>

          {loading ? (
            <View style={styles.menuItem} style={{ opacity: 0.6 }}>
              <Ionicons name="log-out-outline" size={22} color="#101210" />
              <Text style={styles.menuLabel}>Signing out…</Text>
            </View>
          ) : (
            <View style={styles.menuItem} onPress={signOut}>
              <Ionicons name="log-out-outline" size={22} color="#A62A1E" />
              <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Sign out</Text>
            </View>
          )}
        </View>

        <View style={styles.sandboxNote}>
          <Text style={styles.sandboxTitle}>Demo accounts</Text>
          <Text style={styles.sandboxText}>Admin (shop_owner): admin@still.local / Admin1234!</Text>
          <Text style={styles.sandboxText}>Superuser: superuser@still.local / Super1234!</Text>
          <Text style={styles.sandboxText}>Customer: customer@still.local / Customer1234!</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16 },
  header: { marginBottom: 16 },
  headerTitle: { fontFamily: 'Instrument Serif', fontSize: 28, fontWeight: '400', color: '#101210' },
  headerSub: { fontSize: 13, color: '#6C6E64' },
  card: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 16, marginBottom: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, backgroundColor: '#E6F4FE', borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { fontSize: 22, fontWeight: '600', color: '#1E34E8', fontFamily: 'IBM Plex Mono' },
  profileName: { fontSize: 17, fontWeight: '600', color: '#101210', marginBottom: 2 },
  profileEmail: { fontSize: 13, color: '#6C6E64', fontFamily: 'IBM Plex Mono', marginBottom: 4 },
  profileRole: { fontSize: 11, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', color: '#1E34E8' },
  divider: { height: 1, backgroundColor: '#CBC5B7', marginVertical: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E6E1D5' },
  menuLabel: { marginLeft: 12, fontSize: 14, color: '#101210', fontWeight: '500' },
  menuLabelDanger: { color: '#A62A1E' },
  sandboxNote: { marginTop: 24 },
  sandboxTitle: { fontSize: 11, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 0.14, color: '#6C6E64', marginBottom: 8 },
  sandboxText: { fontSize: 12, color: '#34372F', fontFamily: 'IBM Plex Mono', marginBottom: 4 },
};
