import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IS_DEMO, supabase } from '@/services/supabase';
import { useProducts } from '@/store/productsStore';
import { useCart } from '@/store/cartStore';
import type { Product } from '@/data/demo';
import { money } from '@/utils/money';

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const addItem = useCart((state) => state.addItem);
  const demoProducts = useProducts((state) => state.products);

  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        if (IS_DEMO) {
          const found = demoProducts.find((p) => p.id === params.id) || null;
          if (active) setProduct(found);
          return;
        }

        const { data, error } = await supabase
          .from('products')
          .select('*, profiles(username)')
          .eq('id', params.id)
          .single();
        if (error) throw error;
        if (active && data) {
          setProduct({
            id: data.id,
            seller_id: data.seller_id,
            seller: data.profiles?.username || 'STILL',
            name: data.name,
            description: data.description || '',
            price_minor: data.price_minor,
            currency: data.currency || 'NGN',
            stock: data.stock,
            emoji: data.emoji || '📦',
            image_url: data.image_url || '',
            category: data.category || 'Objects',
            active: data.active,
          });
        }
      } catch {
        if (active) setProduct(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [params.id, demoProducts]);

  const handleAdd = () => {
    if (!product) return;
    addItem(product, qty);
    Alert.alert('Added to bag', `${qty} × ${product.name}`, [
      { text: 'Keep shopping', style: 'cancel' },
      { text: 'View bag', onPress: () => router.push('/cart') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#101210" />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Object</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#101210" />
        </View>
      ) : !product ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Product not found</Text>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backHome}>
            <Text style={styles.backHomeText}>Back to shop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.media}>
              {product.image ? (
                <Image source={product.image} style={styles.mediaImage} resizeMode="cover" />
              ) : product.image_url ? (
                <Image source={{ uri: product.image_url }} style={styles.mediaImage} resizeMode="cover" />
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <Text style={styles.mediaEmoji}>{product.emoji}</Text>
                </View>
              )}
            </View>

            <View style={styles.body}>
              <View style={styles.categoryRow}>
                <Text style={styles.category}>{product.category}</Text>
                <Text style={styles.seller}>by {product.seller}</Text>
              </View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>{money(product.price_minor, product.currency as any)}</Text>
              <Text style={styles.productDesc}>{product.description}</Text>

              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Availability</Text>
                <Text style={[styles.stockValue, product.stock === 0 && styles.stockOut]}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}
                </Text>
              </View>

              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Quantity</Text>
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                  >
                    <Ionicons name="remove" size={18} color="#101210" />
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{qty}</Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => setQty((q) => Math.min(product.stock, q + 1))}
                    disabled={product.stock === 0 || qty >= product.stock}
                  >
                    <Ionicons name="add" size={18} color="#101210" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.note}>
                <Ionicons name="leaf-outline" size={16} color="#6C6E64" />
                <Text style={styles.noteText}>Ships in 2–4 days. Free returns within 30 days.</Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.actions, { paddingBottom: 16 + insets.bottom }]}>
            <TouchableOpacity
              style={[styles.addButton, product.stock === 0 && styles.buttonDisabled]}
              onPress={handleAdd}
              disabled={product.stock === 0}
            >
              <Text style={styles.addButtonText}>
                {product.stock === 0 ? 'Sold out' : 'Add to bag'}
              </Text>
              {product.stock > 0 ? (
                <Text style={styles.addButtonPrice}>{money(product.price_minor * qty, product.currency as any)}</Text>
              ) : null}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { width: 38, height: 38, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#6C6E64' },
  loading: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  scrollContent: { paddingBottom: 120 },
  media: { marginHorizontal: 16, aspectRatio: 4 / 5, backgroundColor: '#E6E1D5', borderRadius: 10, overflow: 'hidden' as const },
  mediaImage: { width: '100%', height: '100%' },
  mediaPlaceholder: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  mediaEmoji: { fontSize: 72 },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  categoryRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 6 },
  category: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#1E34E8' },
  seller: { fontSize: 11, color: '#6C6E64' },
  productName: { fontFamily: 'serif', fontSize: 32, color: '#101210', marginBottom: 4 },
  productPrice: { fontSize: 18, fontFamily: 'monospace', color: '#101210', marginBottom: 14 },
  productDesc: { fontSize: 14, color: '#34372F', lineHeight: 22, marginBottom: 20 },
  stockRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#D8D2C4' },
  stockLabel: { fontFamily: 'monospace', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#6C6E64' },
  stockValue: { fontSize: 13, color: '#101210', fontWeight: '600' as const },
  stockOut: { color: '#A62A1E' },
  qtyRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#D8D2C4' },
  qtyLabel: { fontFamily: 'monospace', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#6C6E64' },
  qtyControls: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  qtyButton: { width: 36, height: 36, borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#FFFDF8' },
  qtyValue: { fontSize: 16, fontWeight: '600' as const, color: '#101210', minWidth: 24, textAlign: 'center' as const },
  note: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 18, padding: 12, backgroundColor: '#ECE8DC', borderRadius: 6 },
  noteText: { flex: 1, fontSize: 11, color: '#6C6E64' },
  actions: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#F2EFE7', borderTopWidth: 1, borderTopColor: '#D8D2C4' },
  addButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: '#101210', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 15 },
  addButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  addButtonPrice: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 12 },
  buttonDisabled: { opacity: 0.5 },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: '#101210' },
  backHome: { marginTop: 12 },
  backHomeText: { color: '#1E34E8', fontFamily: 'monospace', fontSize: 12, fontWeight: '600' as const },
};
