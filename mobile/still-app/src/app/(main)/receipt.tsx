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
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { money, formatDate } from '@/utils/money';

type ReceiptParams = { orderId: string; total?: number; paymentMethod?: string; status?: string };

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ReceiptParams>();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, []);

  const loadOrder = async () => {
    setLoading(true);
    try {
      if (params.orderId) {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*), payment_intents(*)')
          .eq('id', params.orderId)
          .single();
        if (error) throw error;
        setOrder(data);
      } else if (params.total != null) {
        setOrder({
          id: params.orderId,
          total_minor: Number(params.total),
          currency: 'NGN',
          status: params.status || 'pending_payment',
          created_at: new Date().toISOString(),
          items: [],
          shipping: {},
          payment: null,
        });
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const total = order?.total_minor ?? (params.total ? Number(params.total) : 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#101210" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Receipt not found</Text>
          <TouchableOpacity style={styles.backHome} onPress={() => router.push('/')}>
            <Text style={styles.backHomeText}>Back to shop</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order Receipt</Text>
        <Text style={styles.headerSub}>Order #{order.id.slice(-6)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.receiptWrapper}>
        <View style={styles.receipt}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptShop}>STILL<span style={styles.receiptMark}>®</span></Text>
            <Text style={styles.receiptLine}>Objects for living — sandbox receipt</Text>
            <Text style={styles.receiptMeta}>Order #{order.id.slice(-6)}</Text>
            <Text style={styles.receiptMeta}>{formatDate(order.created_at)}</Text>
            <Text style={styles.receiptMeta}>Served by: {order.shipping?.name || 'Guest'}</Text>
            <Text style={styles.receiptMeta}>Mode: Sandbox (test only)</Text>
          </View>

          <View style={styles.receiptDivider} />

          {order.items?.map((item: any) => (
            <View key={item.id} style={styles.receiptItem}>
              <Text style={styles.receiptItemName}>{item.name}</Text>
              <View style={styles.receiptItemRow}>
                <Text style={styles.receiptItemQty}>× {item.quantity}</Text>
                <Text style={styles.receiptItemPrice}>{money(item.unit_minor)}</Text>
              </View>
            </View>
          ))}

          <View style={styles.receiptDivider} />

          <View style={styles.receiptTotals}>
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Subtotal</Text>
              <Text style={styles.receiptTotalValue}>{money(total)}</Text>
            </View>
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Shipping</Text>
              <Text style={styles.receiptTotalValue}>Free</Text>
            </View>
            <View style={[styles.receiptTotalRow, styles.receiptTotalRowTotal]}>
              <Text style={styles.receiptTotalLabel}>Total</Text>
              <Text style={styles.receiptTotalValueTotal}>{money(total)}</Text>
            </View>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptPayment}>
            <Text style={styles.receiptPaymentTitle}>Payment</Text>
            <Text style={styles.receiptPaymentMethod}>
              {order.payment?.payment_method?.type || 'Card'}
              {order.payment?.payment_method?.brand ? ` • ${order.payment.payment_method.brand} • ••• ${order.payment.payment_method.last4}` : ''}
            </Text>
            <Text style={styles.receiptPaymentStatus}>
              Status: {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Text>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptFooter}>
            <Text style={styles.receiptFooterLine}>Thank you for buying less, better.</Text>
            <Text style={styles.receiptFooterLine}>This is a sandbox receipt. No real money moved.</Text>
            <Text style={styles.receiptFooterLine}>Receipt ID: {order.id}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/')}>
          <Ionicons name="arrow-back-outline" size={20} color="#101210" />
          <Text style={styles.actionButtonText}>Continue shopping</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonOutline} onPress={() => router.push('/orders')}>
          <Ionicons name="receipt-outline" size={20} color="#1E34E8" />
          <Text style={styles.actionButtonText}>View all orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerTitle: { fontFamily: 'Instrument Serif', fontSize: 26, fontWeight: '400', color: '#101210' },
  headerSub: { fontSize: 13, color: '#6C6E64' },
  receiptWrapper: { paddingHorizontal: 20, paddingBottom: 100 },
  receipt: {
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#CBC5B7',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  receiptShop: { fontFamily: 'Instrument Serif', fontSize: 20, color: '#101210' },
  receiptMark: { color: '#1E34E8' },
  receiptLine: { fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#6C6E64', marginTop: 2 },
  receiptMeta: { fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#6C6E64', marginTop: 1 },
  receiptDivider: { height: 1, backgroundColor: '#CBC5B7', marginVertical: 10 },
  receiptItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  receiptItemName: { fontSize: 12, color: '#101210' },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptItemQty: { fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#6C6E64' },
  receiptItemPrice: { fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  receiptTotals: { marginTop: 6 },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  receiptTotalRowTotal: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#CBC5B7' },
  receiptTotalLabel: { fontSize: 12, color: '#6C6E64' },
  receiptTotalValue: { fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  receiptTotalValueTotal: { fontSize: 13, fontWeight: '600', fontFamily: 'IBM Plex Mono', color: '#101210' },
  receiptPayment: { marginTop: 8 },
  receiptPaymentTitle: { fontSize: 11, fontFamily: 'IBM Plex Mono', fontWeight: '600', color: '#101210', marginBottom: 4 },
  receiptPaymentMethod: { fontSize: 12, color: '#34372F', marginBottom: 2 },
  receiptPaymentStatus: { fontSize: 11, color: '#6C6E64' },
  receiptFooter: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#CBC5B7' },
  receiptFooterLine: { fontSize: 10, fontFamily: 'IBM Plex Mono', color: '#6C6E64', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  actionButton: { flex: 1, backgroundColor: '#101210', padding: 14, borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  actionButtonOutline: { flex: 1, borderWidth: 1, borderColor: '#1E34E8', padding: 14, borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  actionButtonText: { color: '#FFFDF8', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#101210', marginTop: 12 },
  backHome: { marginTop: 12 },
  backHomeText: { color: '#1E34E8', fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: '600' },
};
