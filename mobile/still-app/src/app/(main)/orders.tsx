import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { money, formatDate } from '@/utils/money';

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('buyer_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setOrders(data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <Text style={styles.headerSub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#101210" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={48} color="#CBC5B7" />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Place your first order from the shop.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={({ item }) => (
            <OrderRow order={item} onPress={() => router.push(`/orders/${item.id}`)} />
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

function OrderRow({ order, onPress }: { order: any; onPress: () => void }) {
  const statusUpper = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const badgeKey = `badge${statusUpper}` as keyof typeof styles;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Text style={styles.orderId}>#{order.id.slice(-6)}</Text>
        <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.orderTotal}>{money(order.total_minor, order.currency)}</Text>
        <Text style={[styles.orderBadge, styles[badgeKey]]}>{order.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerTitle: { fontFamily: 'Instrument Serif', fontSize: 28, fontWeight: '400', color: '#101210' },
  headerSub: { fontSize: 13, color: '#6C6E64' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#101210', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#6C6E64' },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 14, marginBottom: 10 },
  rowLeft: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '600', color: '#101210', fontFamily: 'IBM Plex Mono' },
  orderDate: { fontSize: 12, color: '#6C6E64', fontFamily: 'IBM Plex Mono', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 14, fontWeight: '600', fontFamily: 'IBM Plex Mono', color: '#101210', marginBottom: 4 },
  orderBadge: { fontSize: 10, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 0.08, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgePendingPayment: { backgroundColor: '#FFF4E6', color: '#8A5A00' },
  badgePaid: { backgroundColor: '#E6F4FE', color: '#1E34E8' },
  badgePaymentFailed: { backgroundColor: '#FDECEA', color: '#A62A1E' },
  badgeCanceled: { backgroundColor: '#EFEFEF', color: '#6C6E64' },
  badgeRefunded: { backgroundColor: '#E8F5E9', color: '#1D6B45' },
};
