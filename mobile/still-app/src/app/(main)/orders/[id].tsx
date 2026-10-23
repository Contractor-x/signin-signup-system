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

type OrderDetailParams = { orderId: string };

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<OrderDetailParams>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [params.orderId]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), payment_intents(*)')
        .eq('id', params.orderId)
        .single();
      if (error) throw error;
      setOrder(data);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.emptyTitle}>Order not found</Text>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order #{order.id.slice(-6)}</Text>
        <Text style={styles.headerSub}>{formatDate(order.created_at)}</Text>
      </View>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items?.map((item: any) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemMedia}>
                <Text style={styles.itemEmoji}>{item.emoji || '📦'}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.quantity} × {money(item.unit_minor)}</Text>
              </View>
              <Text style={styles.itemLineTotal}>{money(item.unit_minor * item.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping</Text>
          <Text style={styles.shippingField}>{order.shipping?.name || '—'}</Text>
          <Text style={styles.shippingField}>{order.shipping?.address || '—'}</Text>
          <Text style={styles.shippingField}>{order.shipping?.phone || '—'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          {order.payment ? (
            <>
              <Text style={styles.paymentField}>Method: {order.payment.payment_method?.type || 'Card'}</Text>
              <Text style={styles.paymentField}>Status: {order.payment.status}</Text>
              {order.payment.failure_message && (
                <Text style={styles.paymentFieldError}>{order.payment.failure_message}</Text>
              )}
            </>
          ) : (
            <Text style={styles.paymentField}>No payment recorded</Text>
          )}
        </View>

        <View style={[styles.section, styles.totalsSection]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{money(order.total_minor, order.currency)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        {(order.status === 'pending_payment' || order.status === 'payment_failed') && (
          <TouchableOpacity style={styles.payButton} onPress={() => router.push('/checkout')}>
            <Text style={styles.payButtonText}>Pay now</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerTitle: { fontFamily: 'Instrument Serif', fontSize: 24, fontWeight: '400', color: '#101210' },
  headerSub: { fontSize: 13, color: '#6C6E64' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#CBC5B7', backgroundColor: '#FFFDF8', marginHorizontal: 20, marginBottom: 12 },
  statusText: { fontSize: 11, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', color: '#101210' },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 0.14, color: '#6C6E64', marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E6E1D5' },
  itemMedia: { width: 40, height: 40, backgroundColor: '#E6E1D5', borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemEmoji: { fontSize: 20 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#101210', marginBottom: 2 },
  itemMeta: { fontSize: 12, color: '#6C6E64', fontFamily: 'IBM Plex Mono' },
  itemLineTotal: { fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  shippingField: { fontSize: 13, color: '#34372F', marginBottom: 4 },
  paymentField: { fontSize: 13, color: '#34372F', marginBottom: 4 },
  paymentFieldError: { fontSize: 12, color: '#A62A1E', marginTop: 4 },
  totalsSection: { marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#CBC5B7' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#101210' },
  totalValue: { fontSize: 14, fontWeight: '600', fontFamily: 'IBM Plex Mono', color: '#101210' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  payButton: { flex: 1, backgroundColor: '#101210', padding: 14, borderRadius: 6, alignItems: 'center' },
  payButtonText: { color: '#FFFDF8', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase' },
  doneButton: { flex: 1, borderWidth: 1, borderColor: '#CBC5B7', padding: 14, borderRadius: 6, alignItems: 'center' },
  doneButtonText: { fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#101210', textTransform: 'uppercase' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#101210', marginTop: 12 },
  back: { marginTop: 12 },
  backText: { color: '#1E34E8', fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: '600' },
};
