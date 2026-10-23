import React, { useState, useEffect } from 'react';
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
import { money } from '@/utils/money';

export type CartItem = {
  product_id: string;
  name: string;
  unit_minor: number;
  quantity: number;
  image_url: string;
  stock: number;
};

export default function CartScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    setLoading(true);
    try {
      const stored = await supabase.from('profiles').select('id').eq('id', user?.id).single();
      setCart([]);
    } catch {
      setCart([]);
    } finally {
      setLoading(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.unit_minor * item.quantity, 0);

  const removeItem = (id: string) => {
    setCart(cart.filter((c) => c.product_id !== id));
  };

  const changeQty = (id: string, delta: number) => {
    setCart(cart.map((c) => (c.product_id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bag</Text>
        <Text style={styles.headerSub}>{cart.length} item{cart.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#101210" />
        </View>
      ) : cart.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={48} color="#CBC5B7" />
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <Text style={styles.emptySub}>Add objects from the shop.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            renderItem={({ item }) => (
              <CartRow item={item} onRemove={removeItem} onChangeQty={changeQty} />
            )}
            keyExtractor={(item) => item.product_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
          <View style={styles.totals}>
            <View style={[styles.totalsRow, styles.totalsDivider]}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{money(total)}</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsTotal]}>
              <Text style={styles.totalsLabel}>Total</Text>
              <Text style={styles.totalsValueTotal}>{money(total)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={() => router.push('/checkout')}>
            <Text style={styles.checkoutButtonText}>Proceed to checkout</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

function CartRow({ item, onRemove, onChangeQty }: { item: CartItem; onRemove: (id: string) => void; onChangeQty: (id: string, delta: number) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMedia}>
        <Text style={styles.emoji}>{item.image_url ? '📦' : item.emoji}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowPrice}>{money(item.unit_minor)}</Text>
        {item.stock === 0 && <Text style={styles.rowSoldOut}>Out of stock</Text>}
      </View>
      <View style={styles.rowControls}>
        <TouchableOpacity style={styles.qtyButton} onPress={() => onChangeQty(item.product_id, -1)}>
          <Text>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyButton} onPress={() => onChangeQty(item.product_id, 1)} disabled={item.stock === 0 || item.quantity >= item.stock}>
          <Text>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeButton} onPress={() => onRemove(item.product_id)}>
          <Ionicons name="trash-outline" size={18} color="#A62A1E" />
        </TouchableOpacity>
      </View>
    </View>
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
  row: { flexDirection: 'row', backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 12, marginBottom: 10, alignItems: 'center' },
  rowMedia: { width: 60, height: 60, backgroundColor: '#E6E1D5', borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  emoji: { fontSize: 24 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#101210', marginBottom: 2 },
  rowPrice: { fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  rowSoldOut: { fontSize: 11, color: '#A62A1E', fontWeight: '600', marginTop: 4 },
  rowControls: { gap: 8 },
  qtyButton: { width: 30, height: 30, borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF8' },
  qtyText: { fontSize: 14, fontWeight: '600', color: '#101210', minWidth: 24, textAlign: 'center' },
  removeButton: { padding: 6 },
  totals: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FAF8F2', borderTopWidth: 1, borderColor: '#CBC5B7' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalsDivider: { borderBottomWidth: 1, borderBottomColor: '#CBC5B7', paddingBottom: 10, marginBottom: 10 },
  totalsTotal: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#CBC5B7' },
  totalsLabel: { fontSize: 13, color: '#6C6E64' },
  totalsValue: { fontSize: 13, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  totalsValueTotal: { fontSize: 15, fontWeight: '600', fontFamily: 'IBM Plex Mono', color: '#101210' },
  checkoutButton: { backgroundColor: '#101210', padding: 16, borderRadius: 8, alignItems: 'center', marginHorizontal: 20, marginBottom: 24 },
  checkoutButtonText: { color: '#FFFDF8', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase' },
};
