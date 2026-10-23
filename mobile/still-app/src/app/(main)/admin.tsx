import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { money, formatDate } from '@/utils/money';

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [uRes, oRes, pRes] = await Promise.all([
        supabase.from('profiles').select('id, email, username, role, created_at').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('products').select('*, profiles(username)').order('created_at', { ascending: false }).limit(50),
      ]);
      if (uRes.error) throw uRes.error;
      if (oRes.error) throw oRes.error;
      if (pRes.error) throw pRes.error;
      setUsers(uRes.data || []);
      setOrders(oRes.data || []);
      setProducts(pRes.data || []);
    } catch {
      setUsers([]);
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (id: string, currentRole: string) => {
    const roles = ['customer', 'shop_owner', 'superuser'];
    const idx = roles.indexOf(currentRole);
    const nextRole = roles[(idx + 1) % roles.length];
    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', id);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await loadAdminData();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Text style={styles.headerSub}>Platform management</Text>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="#101210" /></View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard title="Users" value={users.length} />
            <StatCard title="Orders" value={orders.length} />
            <StatCard title="Products" value={products.length} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent orders</Text>
            <FlatList
              data={orders}
              renderItem={({ item }) => <OrderRow order={item} />}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Users</Text>
            <FlatList
              data={users}
              renderItem={({ item }) => (
                <UserRow user={item} onChangeRole={changeRole} />
              )}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function OrderRow({ order }: { order: any }) {
  return (
    <View style={styles.orderRow}>
      <Text style={styles.orderId}>#{order.id.slice(-6)}</Text>
      <Text style={styles.orderBuyer}>{order.buyer_id}</Text>
      <Text style={styles.orderTotal}>{money(order.total_minor, order.currency)}</Text>
      <Text style={styles.orderStatus}>{order.status}</Text>
    </View>
  );
}

function UserRow({ user, onChangeRole }: { user: any; onChangeRole: (id: string, role: string) => void }) {
  return (
    <View style={styles.userRow}>
      <View>
        <Text style={styles.userName}>{user.username}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>
      <TouchableOpacity style={styles.roleButton} onPress={() => onChangeRole(user.id, user.role)}>
        <Text style={styles.roleText}>{user.role}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerTitle: { fontFamily: 'Instrument Serif', fontSize: 28, fontWeight: '400', color: '#101210' },
  headerSub: { fontSize: 13, color: '#6C6E64' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 14 },
  statTitle: { fontSize: 10, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', color: '#6C6E64', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '600', fontFamily: 'IBM Plex Mono', color: '#101210' },
  section: { marginHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#101210', marginBottom: 10 },
  listContent: { paddingBottom: 16 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 12, marginBottom: 8 },
  orderId: { fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: '600', color: '#101210' },
  orderBuyer: { fontSize: 12, color: '#6C6E64', fontFamily: 'IBM Plex Mono' },
  orderTotal: { fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  orderStatus: { fontSize: 11, color: '#1E34E8', fontFamily: 'IBM Plex Mono' },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 12, marginBottom: 8 },
  userName: { fontSize: 14, fontWeight: '600', color: '#101210' },
  userEmail: { fontSize: 12, color: '#6C6E64', fontFamily: 'IBM Plex Mono' },
  roleButton: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#1E34E8', borderRadius: 4, backgroundColor: '#E6F4FE' },
  roleText: { fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#1E34E8', textTransform: 'uppercase' },
};
