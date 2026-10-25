import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { IS_DEMO, supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { useOrders, type Order } from '@/store/ordersStore';
import { money, formatDate } from '@/utils/money';

export default function OrdersScreen() {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const demoOrders = useOrders((state) => state.orders);
  const [remoteOrders, setRemoteOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(!IS_DEMO);

  useFocusEffect(
    useCallback(() => {
      if (IS_DEMO) return;

      let active = true;
      const load = async () => {
        setLoading(true);
        try {
          let query = supabase
            .from('orders')
            .select('*, order_items(*)')
            .order('created_at', { ascending: false })
            .limit(50);
          if (user?.id) query = query.eq('buyer_id', user.id);

          const { data, error } = await query;
          if (error) throw error;

          if (active) {
            setRemoteOrders(
              (data || []).map((row: any) => ({
                id: row.id,
                buyer_id: row.buyer_id,
                buyer_name: row.shipping?.name || 'Guest',
                buyer_email: '',
                total_minor: row.total_minor,
                currency: row.currency || 'NGN',
                status: row.status,
                items: row.order_items || [],
                shipping: row.shipping || {},
                payment: { type: 'card', status: 'pending', reference: '' },
                created_at: row.created_at,
              })),
            );
          }
        } catch {
          if (active) setRemoteOrders([]);
        } finally {
          if (active) setLoading(false);
        }
      };
      load();
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  const orders = IS_DEMO ? demoOrders : remoteOrders;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSub}>
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </Text>
        </View>
        <Ionicons name="receipt-outline" size={26} color="#101210" />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#101210" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={52} color="#CBC5B7" />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Your receipts will appear here after checkout.</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.replace('/')}>
            <Text style={styles.shopButtonText}>Browse the collection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.card}
              onPress={() => router.push(`/orders/${order.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                </View>
                <StatusBadge status={order.status} />
              </View>

              <View style={styles.itemPreview}>
                {order.items.slice(0, 4).map((item) => (
                  <View key={item.id} style={styles.thumb}>
                    <Text style={styles.thumbEmoji}>{item.emoji || '📦'}</Text>
                  </View>
                ))}
                {order.items.length > 4 ? (
                  <View style={[styles.thumb, styles.thumbMore]}>
                    <Text style={styles.thumbMoreText}>+{order.items.length - 4}</Text>
                  </View>
                ) : null}
                <View style={styles.previewSpacer} />
                <Text style={styles.orderTotal}>{money(order.total_minor, order.currency as any)}</Text>
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.itemCount}>
                  {order.items.reduce((sum, i) => sum + i.quantity, 0)} objects ·{' '}
                  {order.payment.type.replace(/_/g, ' ')}
                </Text>
                <View style={styles.viewRow}>
                  <Text style={styles.viewText}>View receipt</Text>
                  <Ionicons name="chevron-forward" size={14} color="#1E34E8" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    paid: { bg: '#E8F5E9', fg: '#1D6B45', label: 'Paid' },
    pending_payment: { bg: '#FFF4E6', fg: '#8A5A00', label: 'Pending' },
    payment_failed: { bg: '#FDECEA', fg: '#A62A1E', label: 'Failed' },
    refunded: { bg: '#EFEFEF', fg: '#6C6E64', label: 'Refunded' },
  };
  const tone = palette[status] || palette.pending_payment;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  headerTitle: { fontFamily: 'serif', fontSize: 30, color: '#101210' },
  headerSub: { fontSize: 12, color: '#6C6E64', marginTop: 2 },
  loading: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 32, paddingBottom: 60 },
  emptyTitle: { fontSize: 19, fontWeight: '600' as const, color: '#101210', marginTop: 14 },
  emptySub: { fontSize: 13, color: '#6C6E64', marginTop: 4, textAlign: 'center' as const },
  shopButton: { marginTop: 20, backgroundColor: '#101210', borderRadius: 8, paddingHorizontal: 22, paddingVertical: 13 },
  shopButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const },
  orderId: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700' as const, color: '#101210', letterSpacing: 0.5 },
  orderDate: { fontFamily: 'monospace', fontSize: 9, color: '#6C6E64', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' as const },
  itemPreview: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 12, marginBottom: 12 },
  thumb: { width: 38, height: 38, borderRadius: 5, backgroundColor: '#E6E1D5', alignItems: 'center' as const, justifyContent: 'center' as const },
  thumbEmoji: { fontSize: 16 },
  thumbMore: { backgroundColor: '#D8D2C4' },
  thumbMoreText: { fontFamily: 'monospace', fontSize: 9, color: '#34372F' },
  previewSpacer: { flex: 1 },
  orderTotal: { fontFamily: 'monospace', fontSize: 15, fontWeight: '700' as const, color: '#101210' },
  cardBottom: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, borderTopWidth: 1, borderTopColor: '#E6E1D5', paddingTop: 10 },
  itemCount: { fontSize: 10, color: '#6C6E64', textTransform: 'capitalize' as const },
  viewRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
  viewText: { fontFamily: 'monospace', fontSize: 9, color: '#1E34E8', letterSpacing: 0.5 },
};
