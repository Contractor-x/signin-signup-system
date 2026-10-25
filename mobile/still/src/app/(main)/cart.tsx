import React, { memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart, cartTotal, type CartLine } from '@/store/cartStore';
import { useProducts } from '@/store/productsStore';
import { money } from '@/utils/money';

export default function CartScreen() {
  const router = useRouter();
  const items = useCart((state) => state.items);
  const setQuantity = useCart((state) => state.setQuantity);
  const removeItem = useCart((state) => state.removeItem);
  const products = useProducts((state) => state.products);

  const total = cartTotal(items);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bag</Text>
          <Text style={styles.headerSub}>
            {items.length} {items.length === 1 ? 'object' : 'objects'}
          </Text>
        </View>
        <Ionicons name="bag-handle-outline" size={26} color="#101210" />
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bag-outline" size={52} color="#CBC5B7" />
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <Text style={styles.emptySub}>Add objects from the shop to begin.</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.replace('/')}>
            <Text style={styles.shopButtonText}>Browse the collection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <CartRow
                key={item.product_id}
                item={item}
                product={products.find((p) => p.id === item.product_id)}
                setQuantity={setQuantity}
                removeItem={removeItem}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{money(total)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Shipping</Text>
              <Text style={styles.totalsValue}>Free</Text>
            </View>
            <View style={[styles.totalsRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{money(total)}</Text>
            </View>

            <TouchableOpacity style={styles.checkoutButton} onPress={() => router.push('/checkout')}>
              <Text style={styles.checkoutButtonText}>Proceed to checkout</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFDF8" />
            </TouchableOpacity>
            <Text style={styles.sandboxNote}>Sandbox checkout — no real money moves.</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  headerTitle: { fontFamily: 'serif', fontSize: 30, color: '#101210' },
  headerSub: { fontSize: 12, color: '#6C6E64', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 32, paddingBottom: 60 },
  emptyTitle: { fontSize: 19, fontWeight: '600' as const, color: '#101210', marginTop: 14 },
  emptySub: { fontSize: 13, color: '#6C6E64', marginTop: 4, textAlign: 'center' as const },
  shopButton: { marginTop: 20, backgroundColor: '#101210', borderRadius: 8, paddingHorizontal: 22, paddingVertical: 13 },
  shopButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  row: { flexDirection: 'row' as const, backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 12, marginBottom: 10 },
  rowMedia: { width: 74, height: 92, backgroundColor: '#E6E1D5', borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const, marginRight: 12 },
  rowImage: { width: '100%', height: '100%' },
  rowBody: { flex: 1, justifyContent: 'space-between' },
  rowName: { fontSize: 14, fontWeight: '600' as const, color: '#101210' },
  rowPrice: { fontSize: 12, fontFamily: 'monospace', color: '#34372F', marginTop: 2 },
  rowControls: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 8 },
  qtyGroup: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  qtyButton: { width: 28, height: 28, borderWidth: 1, borderColor: '#A8A294', borderRadius: 5, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#FFFDF8' },
  qtyText: { fontSize: 13, fontWeight: '600' as const, color: '#101210', minWidth: 18, textAlign: 'center' as const },
  // Pushed to the right edge by marginLeft: 'auto' so the delete button sits at a fixed
  // distance from the edge, independent of line-total width or quantity digits.
  rowTotals: { flexDirection: 'row' as const, alignItems: 'center' as const, marginLeft: 'auto' as const },
  removeButton: { padding: 8 },
  lineTotal: { fontSize: 12, fontFamily: 'monospace', color: '#101210', marginRight: 8 },
  footer: { borderTopWidth: 1, borderTopColor: '#CBC5B7', backgroundColor: '#FAF8F2', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  totalsRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 6 },
  totalsLabel: { fontSize: 13, color: '#6C6E64' },
  totalsValue: { fontSize: 13, fontFamily: 'monospace', color: '#34372F' },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: '#CBC5B7', paddingTop: 8, marginTop: 2 },
  grandTotalLabel: { fontSize: 14, fontWeight: '600' as const, color: '#101210' },
  grandTotalValue: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'monospace', color: '#101210' },
  checkoutButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: '#101210', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 15, marginTop: 10 },
  checkoutButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  sandboxNote: { fontSize: 10, color: '#6C6E64', fontFamily: 'monospace', textAlign: 'center' as const, marginTop: 8 },
});

/** Memoized cart row so quantity changes / removes only re-render the touched row. */
const CartRow = memo(function CartRow({ item, product, setQuantity, removeItem }: {
  item: CartLine;
  product: { image?: any; image_url?: string; stock: number } | undefined;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
}) {
  const maxStock = product?.stock ?? 99;
  const imageUri = item.image_url || product?.image_url;
  return (
    <View style={styles.row}>
      <View style={styles.rowMedia}>
        {product?.image ? (
          <Image source={product.image} style={styles.rowImage} resizeMode="cover" />
        ) : imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.rowImage} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={22} color="#A8A294" />
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowPrice}>{money(item.unit_minor, item.currency as any)}</Text>

        <View style={styles.rowControls}>
          <View style={styles.qtyGroup}>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity(item.product_id, item.quantity - 1)}
            >
              <Ionicons name="remove" size={14} color="#101210" />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity(item.product_id, item.quantity + 1)}
              disabled={item.quantity >= maxStock}
            >
              <Ionicons name="add" size={14} color="#101210" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.rowTotals}>
        <Text style={styles.lineTotal}>{money(item.unit_minor * item.quantity, item.currency as any)}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeItem(item.product_id)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={17} color="#A62A1E" />
        </TouchableOpacity>
      </View>
    </View>
  );
});
