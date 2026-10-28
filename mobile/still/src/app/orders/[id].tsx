import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IS_DEMO, supabase } from '@/services/supabase';
import { useOrders, type Order } from '@/store/ordersStore';
import { money, formatDate } from '@/utils/money';

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const demoOrders = useOrders((state) => state.orders);
  const markPaid = useOrders((state) => state.markPaid);
  const [remoteOrder, setRemoteOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(!IS_DEMO);

  useEffect(() => {
    if (IS_DEMO || !params.id) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(
            '*, order_items(*), payment_intents(id, merchant_id, amount, currency, status, description, metadata, payment_method, failure_code, failure_message, next_action, amount_refunded, created_at)',
          )
          .eq('id', params.id)
          .single();
        if (error) throw error;
        const payment = Array.isArray(data.payment_intents)
          ? data.payment_intents[0]
          : data.payment_intents;

        if (active) {
          setRemoteOrder({
            id: data.id,
            buyer_id: data.buyer_id,
            buyer_name: data.shipping?.name || 'Guest',
            buyer_email: '',
            total_minor: data.total_minor,
            currency: data.currency || 'NGN',
            status: data.status,
            items: (data.order_items || []).map((item: any) => ({ ...item, emoji: item.emoji || '📦' })),
            shipping: data.shipping || { name: '', address: '', phone: '' },
            payment: payment
              ? {
                  type: payment.payment_method?.type || 'card',
                  status: payment.status === 'succeeded' ? 'paid' : 'pending',
                  brand: payment.payment_method?.brand,
                  last4: payment.payment_method?.last4,
                  reference: payment.id,
                  failure_message: payment.failure_message,
                }
              : { type: 'card', status: 'pending', reference: '' },
            created_at: data.created_at,
          });
        }
      } catch {
        if (active) setRemoteOrder(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [params.id]);

  const order = IS_DEMO ? demoOrders.find((o) => o.id === params.id) : remoteOrder;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#101210" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Order not found</Text>
          <TouchableOpacity style={styles.backHome} onPress={() => router.replace('/orders')}>
            <Text style={styles.backHomeText}>Back to orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusTone =
    order.status === 'paid'
      ? { bg: '#E8F5E9', fg: '#1D6B45' }
      : order.status === 'payment_failed'
        ? { bg: '#FDECEA', fg: '#A62A1E' }
        : { bg: '#FFF4E6', fg: '#8A5A00' };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#101210" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order</Text>
        <TouchableOpacity onPress={() => router.push('/receipt?orderId=' + order.id)} hitSlop={8}>
          <Ionicons name="receipt-outline" size={22} color="#101210" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          <View style={[styles.badge, { backgroundColor: statusTone.bg }]}>
            <Text style={[styles.badgeText, { color: statusTone.fg }]}>
              {order.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Objects</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemMedia}>
                <Text style={styles.itemEmoji}>{item.emoji || '📦'}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} × {money(item.unit_minor, order.currency as any)}
                </Text>
              </View>
              <Text style={styles.itemLineTotal}>
                {money(item.unit_minor * item.quantity, order.currency as any)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{money(order.total_minor, order.currency as any)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <Text style={styles.bodyText}>{order.shipping?.name}</Text>
          <Text style={styles.bodyText}>{order.shipping?.address}</Text>
          <Text style={styles.bodyText}>{order.shipping?.phone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Method</Text>
            <Text style={styles.kvValue}>{order.payment.type.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Status</Text>
            <Text style={styles.kvValue}>{order.payment.status}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Reference</Text>
            <Text style={styles.kvValue}>{order.payment.reference}</Text>
          </View>
          {order.payment.failure_message ? (
            <Text style={styles.failure}>{order.payment.failure_message}</Text>
          ) : null}
        </View>

        {order.status === 'pending_payment' ? (
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={() => markPaid(order.id)}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFDF8" />
            <Text style={styles.markPaidText}>Mark as paid (sandbox)</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.receiptButton} onPress={() => router.push('/receipt?orderId=' + order.id)}>
          <Text style={styles.receiptButtonText}>View thermal receipt</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { width: 38, height: 38, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerTitle: { fontFamily: 'serif', fontSize: 22, color: '#101210' },
  content: { paddingHorizontal: 18, paddingBottom: 30 },
  loading: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  hero: { alignItems: 'center' as const, paddingVertical: 18 },
  orderId: { fontFamily: 'serif', fontSize: 32, color: '#101210', letterSpacing: 1 },
  orderDate: { fontFamily: 'monospace', fontSize: 10, color: '#6C6E64', marginTop: 2, marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  badgeText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  section: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 10, padding: 16, marginBottom: 12 },
  sectionTitle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 10 },
  itemRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E6E1D5' },
  itemMedia: { width: 38, height: 38, borderRadius: 6, backgroundColor: '#E6E1D5', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 10 },
  itemEmoji: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600' as const, color: '#101210' },
  itemMeta: { fontSize: 10, fontFamily: 'monospace', color: '#6C6E64', marginTop: 2 },
  itemLineTotal: { fontSize: 11, fontFamily: 'monospace', color: '#34372F' },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 12 },
  totalLabel: { fontSize: 13, fontWeight: '700' as const, color: '#101210' },
  totalValue: { fontSize: 14, fontFamily: 'monospace', fontWeight: '700' as const, color: '#101210' },
  bodyText: { fontSize: 13, color: '#34372F', marginBottom: 3 },
  kvRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 4 },
  kvKey: { fontSize: 12, color: '#6C6E64' },
  kvValue: { fontSize: 12, fontFamily: 'monospace', color: '#34372F', textTransform: 'capitalize' as const },
  failure: { marginTop: 6, fontSize: 11, color: '#A62A1E' },
  markPaidButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: '#1D6B45', borderRadius: 8, paddingVertical: 14, marginBottom: 10 },
  markPaidText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  receiptButton: { borderWidth: 1, borderColor: '#101210', borderRadius: 8, paddingVertical: 14, alignItems: 'center' as const },
  receiptButtonText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: '#101210' },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: '#101210' },
  backHome: { marginTop: 12 },
  backHomeText: { color: '#1E34E8', fontFamily: 'monospace', fontSize: 12, fontWeight: '600' as const },
};
