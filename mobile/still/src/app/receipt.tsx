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

const METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  wallet: 'Wallet / USSD',
  bank_transfer: 'Bank transfer',
};

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string }>();
  const demoOrders = useOrders((state) => state.orders);
  const [remoteOrder, setRemoteOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(!IS_DEMO);

  useEffect(() => {
    if (IS_DEMO || !params.orderId) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(
            '*, order_items(*), payment_intents(id, merchant_id, amount, currency, status, description, metadata, payment_method, failure_code, failure_message, next_action, amount_refunded, created_at)',
          )
          .eq('id', params.orderId)
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
            items: (data.order_items || []).map((item: any) => ({
              ...item,
              emoji: item.emoji || '📦',
            })),
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
  }, [params.orderId]);

  const order = IS_DEMO
    ? demoOrders.find((o) => o.id === params.orderId)
    : remoteOrder;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#101210" />
          <Text style={styles.loadingText}>Printing receipt…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={48} color="#CBC5B7" />
          <Text style={styles.emptyTitle}>Receipt not found</Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/')}>
            <Text style={styles.homeButtonText}>Back to shop</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const paid = order.status === 'paid';
  const statusLabel = order.status.replace(/_/g, ' ');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')} hitSlop={8}>
          <Ionicons name="close" size={22} color="#101210" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receipt</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.receiptWrapper} showsVerticalScrollIndicator={false}>
        <View style={styles.receiptShadow}>
          <View style={styles.receipt}>
            <View style={styles.perforation}>
              {[...Array(22)].map((_, i) => (
                <View key={i} style={styles.perfDot} />
              ))}
            </View>

            <View style={styles.receiptHeader}>
              <Text style={styles.receiptShop}>STILL<Text style={styles.receiptMark}>®</Text></Text>
              <Text style={styles.receiptLine}>OBJECTS FOR LIVING / VOL. 01</Text>
              <Text style={styles.receiptLine}>SANDBOX RECEIPT — NO REAL MONEY</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>ORDER</Text>
              <Text style={styles.metaValue}>#{order.id.slice(-6).toUpperCase()}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>DATE</Text>
              <Text style={styles.metaValue}>{formatDate(order.created_at)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>SERVED BY</Text>
              <Text style={styles.metaValue}>{order.shipping?.name || order.buyer_name || 'Guest'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>STATUS</Text>
              <Text style={[styles.metaValue, paid ? styles.paid : styles.pending]}>
                {statusLabel.toUpperCase()}
              </Text>
            </View>

            <View style={styles.divider} />

            {order.items.map((item) => (
              <View key={item.id} style={styles.itemBlock}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemEmoji}>{item.emoji || '📦'}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemTotal}>{money(item.unit_minor * item.quantity, order.currency as any)}</Text>
                </View>
                <Text style={styles.itemMeta}>
                  {item.quantity} × {money(item.unit_minor, order.currency as any)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>SUBTOTAL</Text>
              <Text style={styles.totalValue}>{money(order.total_minor, order.currency as any)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>SHIPPING</Text>
              <Text style={styles.totalValue}>FREE</Text>
            </View>
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={styles.grandValue}>{money(order.total_minor, order.currency as any)}</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>PAYMENT</Text>
            <Text style={styles.paymentLine}>
              {METHOD_LABELS[order.payment?.type] || 'Card'}
              {order.payment?.brand ? ` · ${order.payment.brand}` : ''}
              {order.payment?.last4 ? ` · •••• ${order.payment.last4}` : ''}
            </Text>
            <Text style={styles.paymentLine}>Ref: {order.payment?.reference || '—'}</Text>
            {order.payment?.failure_message ? (
              <Text style={styles.failure}>{order.payment.failure_message}</Text>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>DELIVERY</Text>
            <Text style={styles.addressLine}>{order.shipping?.address || '—'}</Text>
            <Text style={styles.addressLine}>{order.shipping?.phone || '—'}</Text>

            <View style={styles.divider} />

            <View style={styles.receiptFooter}>
              <Text style={styles.footerLine}>Thank you for buying less, better.</Text>
              <Text style={styles.footerLine}>
                {paid ? 'Payment captured in sandbox.' : 'Payment is awaiting confirmation.'}
              </Text>
              <Text style={styles.footerSmall}>RECEIPT {order.id.toUpperCase()}</Text>
              <Text style={styles.footerSmall}>STILL · LAGOS · {new Date(order.created_at).getFullYear()}</Text>
            </View>

            <View style={styles.barcode}>
              {[...Array(38)].map((_, i) => (
                <View
                  key={i}
                  style={[styles.bar, { width: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1 }]}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButtonOutline} onPress={() => router.replace('/orders')}>
          <Ionicons name="receipt-outline" size={18} color="#1E34E8" />
          <Text style={styles.actionButtonOutlineText}>All orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.replace('/')}>
          <Text style={styles.actionButtonText}>Keep shopping</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFDF8" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#E6E1D5' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { width: 38, height: 38, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerTitle: { fontFamily: 'serif', fontSize: 22, color: '#101210' },
  loading: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  loadingText: { marginTop: 10, fontFamily: 'monospace', fontSize: 11, color: '#6C6E64' },
  receiptWrapper: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 },
  receiptShadow: { backgroundColor: '#CBC5B7', borderRadius: 4, marginBottom: 4 },
  receipt: { backgroundColor: '#FFFDF8', borderRadius: 4, paddingHorizontal: 18, paddingBottom: 18, marginBottom: -2 },
  perforation: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingVertical: 6 },
  perfDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D8D2C4' },
  receiptHeader: { alignItems: 'center' as const, marginBottom: 8 },
  receiptShop: { fontFamily: 'serif', fontSize: 26, letterSpacing: 3, color: '#101210' },
  receiptMark: { fontSize: 12, color: '#1E34E8' },
  receiptLine: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1.1, color: '#6C6E64', marginTop: 2, textAlign: 'center' as const },
  divider: { borderBottomWidth: 1, borderStyle: 'dashed' as const, borderBottomColor: '#B9B3A5', marginVertical: 10 },
  metaRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 3 },
  metaKey: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, color: '#6C6E64' },
  metaValue: { fontFamily: 'monospace', fontSize: 9, color: '#101210', flexShrink: 1, textAlign: 'right' as const, marginLeft: 12 },
  paid: { color: '#1D6B45' },
  pending: { color: '#8A5A00' },
  itemBlock: { marginBottom: 8 },
  itemTop: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 6 },
  itemEmoji: { fontSize: 12, marginTop: 1 },
  itemName: { flex: 1, fontFamily: 'monospace', fontSize: 10, color: '#101210', lineHeight: 15 },
  itemTotal: { fontFamily: 'monospace', fontSize: 10, color: '#101210' },
  itemMeta: { fontFamily: 'monospace', fontSize: 9, color: '#6C6E64', marginLeft: 18, marginTop: 1 },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 4 },
  totalLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, color: '#6C6E64' },
  totalValue: { fontFamily: 'monospace', fontSize: 10, color: '#34372F' },
  grandRow: { borderTopWidth: 1, borderTopColor: '#101210', paddingTop: 8, marginTop: 6 },
  grandLabel: { fontFamily: 'monospace', fontSize: 12, letterSpacing: 1.5, color: '#101210', fontWeight: '700' as const },
  grandValue: { fontFamily: 'monospace', fontSize: 14, color: '#101210', fontWeight: '700' as const },
  sectionLabel: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1.5, color: '#6C6E64', marginBottom: 4 },
  paymentLine: { fontFamily: 'monospace', fontSize: 10, color: '#34372F', marginBottom: 2 },
  failure: { fontFamily: 'monospace', fontSize: 9, color: '#A62A1E', marginTop: 4 },
  addressLine: { fontFamily: 'monospace', fontSize: 10, color: '#34372F', marginBottom: 2 },
  receiptFooter: { alignItems: 'center' as const, marginTop: 2 },
  footerLine: { fontFamily: 'monospace', fontSize: 9, color: '#6C6E64', marginBottom: 2, textAlign: 'center' as const },
  footerSmall: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.8, color: '#A8A294', marginTop: 6, textAlign: 'center' as const },
  barcode: { flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'flex-end' as const, gap: 2, marginTop: 14, height: 30 },
  bar: { height: 26, backgroundColor: '#101210' },
  actions: { flexDirection: 'row' as const, gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  actionButton: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, backgroundColor: '#101210', borderRadius: 6, paddingVertical: 13 },
  actionButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  actionButtonOutline: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, borderWidth: 1, borderColor: '#1E34E8', backgroundColor: '#FFFDF8', borderRadius: 6, paddingVertical: 13 },
  actionButtonOutlineText: { color: '#1E34E8', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: '#101210', marginTop: 12 },
  homeButton: { marginTop: 14, backgroundColor: '#101210', borderRadius: 6, paddingHorizontal: 18, paddingVertical: 12 },
  homeButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase' as const },
};
