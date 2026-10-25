import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IS_DEMO, supabase } from '@/services/supabase';
import { useProducts } from '@/store/productsStore';
import { useOrders } from '@/store/ordersStore';
import { DEMO_ACCOUNTS } from '@/data/demo';
import { money, formatDate } from '@/utils/money';

export default function AdminScreen() {
  const router = useRouter();
  const demoProducts = useProducts((state) => state.products);
  const demoOrders = useOrders((state) => state.orders);
  const [remote, setRemote] = useState<{ users: any[]; orders: any[]; products: any[] }>({
    users: [],
    orders: [],
    products: [],
  });
  const [loading, setLoading] = useState(!IS_DEMO);

  useEffect(() => {
    if (IS_DEMO) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [users, orders, products] = await Promise.all([
          supabase.rpc('admin_list_profiles'),
          supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('products').select('*').limit(100),
        ]);
        if (active) {
          setRemote({
            users: users.data || [],
            orders: orders.data || [],
            products: products.data || [],
          });
        }
      } catch {
        // Keep the empty state.
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const users = useMemo(() => {
    if (IS_DEMO) {
      return DEMO_ACCOUNTS.map((a) => ({
        id: a.id,
        email: a.email,
        username: a.username,
        role: a.role,
      }));
    }
    return remote.users;
  }, [remote.users]);

  const orders = IS_DEMO ? demoOrders : remote.orders;
  const products = IS_DEMO ? demoProducts : remote.products;
  const paidTotal = orders
    .filter((o: any) => o.status === 'paid')
    .reduce((sum: number, o: any) => sum + o.total_minor, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#101210" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#101210" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Platform</Text>
            <Text style={styles.heroSub}>Sandbox operations overview</Text>
          </View>

          <View style={styles.statsRow}>
            <Stat label="Users" value={String(users.length)} />
            <Stat label="Orders" value={String(orders.length)} />
            <Stat label="Paid" value={money(paidTotal)} />
          </View>

          <Text style={styles.sectionTitle}>Recent orders</Text>
          {orders.slice(0, 8).map((order: any) => (
            <TouchableOpacity
              key={order.id}
              style={styles.row}
              onPress={() => router.push(`/orders/${order.id}`)}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>#{order.id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.rowMeta}>
                  {order.buyer_name || order.buyer_id || 'guest'} · {formatDate(order.created_at)}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowAmount}>{money(order.total_minor, order.currency as any)}</Text>
                <Text style={styles.rowStatus}>{order.status.replace(/_/g, ' ')}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {orders.length === 0 ? <Text style={styles.empty}>No orders yet.</Text> : null}

          <Text style={styles.sectionTitle}>People</Text>
          {users.map((user: any) => (
            <View key={user.id} style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user.username || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{user.username}</Text>
                <Text style={styles.rowMeta}>{user.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.rolePill}
                onPress={() =>
                  Alert.alert('Role management', 'Role changes are disabled in the local sandbox.')
                }
              >
                <Text style={styles.roleText}>{user.role.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Catalogue</Text>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{products.length} objects</Text>
              <Text style={styles.rowMeta}>Managed from the seller dashboard</Text>
            </View>
            <Ionicons name="cube-outline" size={20} color="#6C6E64" />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { width: 38, height: 38, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerTitle: { fontFamily: 'serif', fontSize: 22, color: '#101210' },
  loading: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  content: { paddingHorizontal: 18, paddingBottom: 30 },
  hero: { paddingVertical: 10 },
  heroTitle: { fontFamily: 'serif', fontSize: 30, color: '#101210' },
  heroSub: { fontSize: 11, color: '#6C6E64', marginTop: 2 },
  statsRow: { flexDirection: 'row' as const, gap: 8, marginVertical: 12 },
  statCard: { flex: 1, backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 12 },
  statLabel: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 4 },
  statValue: { fontFamily: 'monospace', fontSize: 12, color: '#101210', fontWeight: '700' as const },
  sectionTitle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6C6E64', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 11, marginBottom: 7, gap: 10 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 12, fontWeight: '600' as const, color: '#101210', fontFamily: 'monospace' },
  rowMeta: { fontSize: 9, color: '#6C6E64', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' as const },
  rowAmount: { fontSize: 11, fontFamily: 'monospace', color: '#101210' },
  rowStatus: { fontSize: 8, fontFamily: 'monospace', color: '#1E34E8', textTransform: 'capitalize' as const, marginTop: 2 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E6F4FE', alignItems: 'center' as const, justifyContent: 'center' as const },
  avatarText: { fontSize: 12, fontWeight: '700' as const, color: '#1E34E8' },
  rolePill: { borderWidth: 1, borderColor: '#1E34E8', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  roleText: { fontFamily: 'monospace', fontSize: 7, color: '#1E34E8', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  empty: { fontSize: 11, color: '#6C6E64', fontStyle: 'italic' as const },
};
