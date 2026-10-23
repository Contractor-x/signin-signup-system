import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/services/supabase';
import { money } from '@/utils/money';

type ProductDetailParams = { productId: string };

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ProductDetailParams>();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [params.productId]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, profiles(username)')
        .eq('id', params.productId)
        .single();
      if (error) throw error;
      setProduct(data);
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={24} color="#101210" />
          </TouchableOpacity>
        </View>
        <View style={styles.media}>
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaEmoji}>📦</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={24} color="#101210" />
          </TouchableOpacity>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Product not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={24} color="#101210" />
          </TouchableOpacity>
        </View>

        <View style={styles.media}>
          <View style={styles.mediaPlaceholder}>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.mediaImage} />
            ) : (
              <View style={styles.mediaPlaceholderEmpty}>
                <Text style={styles.mediaEmoji}>{product.emoji}</Text>
              </View>
            )}
            <View style={styles.emojiBadge}>{product.emoji}</View>
          </View>
          <Text style={styles.mediaCategory}>{product.category}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>{money(product.price_minor, product.currency)}</Text>
          <Text style={styles.productDesc}>{product.description}</Text>
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Stock</Text>
            <Text style={styles.stockValue}>{product.stock > 0 ? product.stock + ' available' : 'Out of stock'}</Text>
          </View>
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyButton} onPress={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
                <Text>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{qty}</Text>
              <TouchableOpacity style={styles.qtyButton} onPress={() => setQty((q) => Math.min(product.stock, q + 1))} disabled={product.stock === 0 || qty >= product.stock}>
                <Text>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => {}} disabled={product.stock === 0}>
            <Text style={styles.addButtonText}>{product.stock === 0 ? 'Sold out' : 'Add to bag'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  scrollContent: { paddingBottom: 80 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  backButton: { padding: 8 },
  media: { marginBottom: 16 },
  mediaPlaceholder: { width: '100%', aspectRatio: 1, backgroundColor: '#E6E1D5', borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mediaPlaceholderEmpty: { width: '100%', height: '100%', backgroundColor: '#E6E1D5', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mediaEmoji: { fontSize: 64 },
  mediaImage: { width: '100%', height: '100%', borderRadius: 10 },
  emojiBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,253,248,0.9)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  mediaCategory: { fontSize: 11, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 0.14, color: '#6C6E64', marginTop: 6, textAlign: 'center' },
  card: { paddingHorizontal: 20 },
  productName: { fontFamily: 'Instrument Serif', fontSize: 30, fontWeight: '400', color: '#101210', marginBottom: 4 },
  productPrice: { fontSize: 18, fontWeight: '600', fontFamily: 'IBM Plex Mono', color: '#101210', marginBottom: 12 },
  productDesc: { fontSize: 14, color: '#34372F', lineHeight: 22, marginBottom: 16 },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stockLabel: { fontSize: 12, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', color: '#6C6E64' },
  stockValue: { fontSize: 14, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  qtyLabel: { fontSize: 12, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', color: '#6C6E64' },
  qtyControls: { flexDirection: 'row', gap: 8 },
  qtyButton: { width: 36, height: 36, borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF8' },
  qtyValue: { fontSize: 16, fontWeight: '600', color: '#101210', minWidth: 30, textAlign: 'center' },
  addButton: { backgroundColor: '#101210', padding: 14, borderRadius: 8, alignItems: 'center' },
  addButtonText: { color: '#FFFDF8', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#101210', marginTop: 12 },
};
