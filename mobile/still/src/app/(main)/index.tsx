import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { IS_DEMO, supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { useCart } from '@/store/cartStore';
import { useProducts } from '@/store/productsStore';
import { CATEGORIES, type Product } from '@/data/demo';
import { money } from '@/utils/money';
import { ColorScroll } from '@/components/ColorScroll';

const SORTS = [
  { key: 'featured', label: 'featured' },
  { key: 'price_asc', label: 'price ↑' },
  { key: 'price_desc', label: 'price ↓' },
  { key: 'name_asc', label: 'A–Z' },
] as const;

export default function StoreScreen() {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItem = useCart((state) => state.addItem);
  const demoProducts = useProducts((state) => state.products);
  const [remoteProducts, setRemoteProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<string>('featured');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewQuantity, setPreviewQuantity] = useState(1);

  const openPreview = (product: Product) => {
    setPreviewQuantity(1);
    setPreviewProduct(product);
  };

  const closePreview = () => setPreviewProduct(null);

  const addPreviewToBag = (goToCheckout: boolean) => {
    if (!previewProduct) return;
    addItem(previewProduct, previewQuantity);
    const message = `${previewQuantity} × ${previewProduct.name} added to bag`;
    setPreviewProduct(null);
    if (goToCheckout) {
      router.push('/checkout');
    } else if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const viewFullDetails = () => {
    if (!previewProduct) return;
    const id = previewProduct.id;
    setPreviewProduct(null);
    router.push(`/product/${id}`);
  };

  const fetchProducts = useCallback(async () => {
    if (IS_DEMO) {
      setLoading(true);
      setError('');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*, profiles(username)')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      setRemoteProducts(
        (data || []).map((row: any) => ({
          id: row.id,
          seller_id: row.seller_id,
          seller: row.profiles?.username || 'STILL',
          name: row.name,
          description: row.description || '',
          price_minor: row.price_minor,
          currency: row.currency || 'NGN',
          stock: row.stock,
          emoji: row.emoji || '📦',
          image_url: row.image_url || '',
          category: row.category || 'Objects',
          active: row.active,
        })),
      );
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Could not load the collection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts]),
  );

  const products = useMemo(() => {
    const source = (IS_DEMO ? demoProducts : remoteProducts).filter((p) => p.active);
    const needle = query.trim().toLowerCase();

    const filtered = source.filter((p) => {
      const categoryOk = selectedCategory === 'All' || p.category === selectedCategory;
      const searchOk =
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle);
      return categoryOk && searchOk;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'price_asc') return a.price_minor - b.price_minor;
      if (sort === 'price_desc') return b.price_minor - a.price_minor;
      if (sort === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [demoProducts, remoteProducts, query, selectedCategory, sort]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ColorScroll
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>STILL</Text>
            <Text style={styles.subtitle}>Objects for living / Vol. 01</Text>
          </View>
          {IS_DEMO ? (
            <View style={styles.demoPill}>
              <Text style={styles.demoPillText}>Sandbox</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#6C6E64" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search objects…"
            placeholderTextColor="#8C8E84"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#A8A294" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sortHeader}>
          <Text style={styles.sectionLabel}>Collection</Text>
          <Text style={styles.count}>{products.length} objects</Text>
        </View>
        <View style={styles.chipWrap}>
          {SORTS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.chipSmall, sort === s.key && styles.chipActive]}
              onPress={() => setSort(s.key)}
            >
              <Text style={[styles.chipText, sort === s.key && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <TouchableOpacity style={styles.errorBanner} onPress={fetchProducts}>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#101210" />
            <Text style={styles.loadingText}>Loading collection…</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={42} color="#CBC5B7" />
            <Text style={styles.emptyText}>No objects found.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onPress={() => openPreview(item)}
              />
            ))}
          </View>
        )}

        {user && user.role !== 'customer' ? (
          <TouchableOpacity style={styles.sellerLink} onPress={() => router.push('/seller')}>
            <Text style={styles.sellerLinkText}>Open seller dashboard</Text>
            <Ionicons name="arrow-forward" size={16} color="#1E34E8" />
          </TouchableOpacity>
        ) : null}
      </ColorScroll>

      <Modal
        visible={!!previewProduct}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closePreview}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closePreview} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            <View style={styles.sheetGrabber} />
            {previewProduct ? (
              <>
                <View style={styles.sheetTop}>
                  <ProductImage product={previewProduct} style={styles.sheetImage} />
                  <View style={styles.sheetInfo}>
                    <Text style={styles.sheetCategory}>{previewProduct.category}</Text>
                    <Text style={styles.sheetName} numberOfLines={2}>{previewProduct.name}</Text>
                    <Text style={styles.sheetPrice}>
                      {money(previewProduct.price_minor, previewProduct.currency as any)}
                    </Text>
                    <Text style={styles.sheetStock}>{previewProduct.stock} in stock</Text>
                  </View>
                  <TouchableOpacity style={styles.sheetClose} onPress={closePreview} hitSlop={10}>
                    <Ionicons name="close" size={20} color="#101210" />
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetQtyRow}>
                  <Text style={styles.sheetQtyLabel}>Quantity</Text>
                  <View style={styles.sheetQtyControls}>
                    <TouchableOpacity
                      style={[styles.sheetQtyButton, previewQuantity <= 1 && styles.sheetQtyDisabled]}
                      onPress={() => setPreviewQuantity((q) => Math.max(1, q - 1))}
                      disabled={previewQuantity <= 1}
                    >
                      <Ionicons name="remove" size={18} color="#101210" />
                    </TouchableOpacity>
                    <Text style={styles.sheetQtyValue}>{previewQuantity}</Text>
                    <TouchableOpacity
                      style={[
                        styles.sheetQtyButton,
                        previewQuantity >= previewProduct.stock && styles.sheetQtyDisabled,
                      ]}
                      onPress={() =>
                        setPreviewQuantity((q) => Math.min(previewProduct.stock, q + 1))
                      }
                      disabled={previewQuantity >= previewProduct.stock}
                    >
                      <Ionicons name="add" size={18} color="#101210" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.sheetTotalRow}>
                  <Text style={styles.sheetTotalLabel}>Subtotal</Text>
                  <Text style={styles.sheetTotalValue}>
                    {money(
                      previewProduct.price_minor * previewQuantity,
                      previewProduct.currency as any,
                    )}
                  </Text>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.sheetSecondary, previewProduct.stock === 0 && styles.buttonDisabled]}
                    onPress={() => addPreviewToBag(false)}
                    disabled={previewProduct.stock === 0}
                  >
                    <Text style={styles.sheetSecondaryText}>
                      {previewProduct.stock === 0 ? 'Sold out' : 'Add to bag'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetPrimary, previewProduct.stock === 0 && styles.buttonDisabled]}
                    onPress={() => addPreviewToBag(true)}
                    disabled={previewProduct.stock === 0}
                  >
                    <Text style={styles.sheetPrimaryText}>Checkout</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFDF8" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.sheetDetails} onPress={viewFullDetails}>
                  <Text style={styles.sheetDetailsText}>View full details</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProductImage({
  product,
  style,
}: {
  product: Product;
  style: any;
}) {
  if (product.image) {
    return <Image source={product.image} style={style} resizeMode="cover" />;
  }
  if (product.image_url) {
    return <Image source={{ uri: product.image_url }} style={style} resizeMode="cover" />;
  }
  return (
    <View style={[style, styles.mediaPlaceholder]}>
      <Text style={styles.mediaEmoji}>{product.emoji}</Text>
    </View>
  );
}

const ProductCard = React.memo(function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.media}>
        <ProductImage product={product} style={styles.image} />
        {product.stock === 0 ? (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.cardPrice}>{money(product.price_minor, product.currency as any)}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardStock}>{product.stock} in stock</Text>
          <Text style={styles.cardCategory}>{product.category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  scrollContent: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  appTitle: { fontFamily: 'serif', fontSize: 34, fontWeight: '400' as const, color: '#101210', letterSpacing: 1 },
  subtitle: { fontSize: 12, color: '#6C6E64', marginTop: 2 },
  demoPill: { borderWidth: 1, borderColor: '#1E34E8', backgroundColor: '#E6F4FE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  demoPillText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#1E34E8' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#101210' },
  sectionLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6C6E64', paddingHorizontal: 16, marginBottom: 8 },
  chipWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4, paddingHorizontal: 12, marginBottom: 16 },
  chip: { width: '24%', paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#A8A294', borderRadius: 20, backgroundColor: '#FFFDF8', alignItems: 'center' as const },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 16, backgroundColor: '#FFFDF8' },
  chipActive: { borderColor: '#1E34E8', backgroundColor: '#E6F4FE' },
  chipText: { fontSize: 10, fontFamily: 'monospace', color: '#34372F', textAlign: 'center' as const },
  chipTextActive: { color: '#1E34E8', fontWeight: '700' as const },
  sortHeader: { flexDirection: 'row' as const, alignItems: 'baseline' as const, justifyContent: 'space-between' as const, paddingRight: 16 },
  count: { fontSize: 11, fontFamily: 'monospace', color: '#6C6E64' },
  errorBanner: { marginHorizontal: 16, marginBottom: 12, padding: 10, borderWidth: 1, borderColor: '#E7B4AC', backgroundColor: '#FDECEA', borderRadius: 6 },
  errorText: { fontSize: 11, color: '#A62A1E' },
  loading: { paddingVertical: 48, alignItems: 'center' as const },
  loadingText: { marginTop: 10, fontSize: 12, color: '#6C6E64', fontFamily: 'monospace' },
  emptyState: { paddingVertical: 56, alignItems: 'center' as const },
  emptyText: { marginTop: 10, fontSize: 14, color: '#6C6E64' },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: 12 },
  card: { width: '50%', paddingHorizontal: 4, marginBottom: 16 },
  media: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#E6E1D5', borderRadius: 8, overflow: 'hidden' as const, position: 'relative' as const },
  image: { width: '100%', height: '100%' },
  mediaPlaceholder: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  mediaEmoji: { fontSize: 56 },
  soldOutOverlay: { ...({ position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 }), backgroundColor: 'rgba(16,18,16,0.45)', alignItems: 'center' as const, justifyContent: 'center' as const },
  soldOutText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' as const },
  cardBody: { paddingTop: 8, paddingHorizontal: 2 },
  cardName: { fontSize: 13, fontWeight: '600' as const, color: '#101210', marginBottom: 2 },
  cardPrice: { fontSize: 12, fontFamily: 'monospace', color: '#34372F', marginBottom: 4 },
  cardFooter: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  cardStock: { fontSize: 10, color: '#6C6E64' },
  cardCategory: { fontSize: 10, color: '#6C6E64' },
  sellerLink: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, marginTop: 8, paddingVertical: 12 },
  sellerLinkText: { fontSize: 12, fontFamily: 'monospace', color: '#1E34E8' },

  // Quick-look sheet
  modalRoot: { flex: 1, justifyContent: 'flex-end' as const },
  modalBackdrop: { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,18,16,0.52)' },
  sheet: {
    backgroundColor: '#FFFDF8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetGrabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBC5B7', alignSelf: 'center' as const, marginBottom: 16 },
  sheetTop: { flexDirection: 'row' as const, gap: 14, alignItems: 'flex-start' as const },
  sheetImage: { width: 104, aspectRatio: 3 / 4, borderRadius: 8, backgroundColor: '#E6E1D5' },
  sheetInfo: { flex: 1, paddingTop: 4 },
  sheetClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#F2EFE7' },
  sheetCategory: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' as const, color: '#1E34E8', marginBottom: 4 },
  sheetName: { fontFamily: 'serif', fontSize: 23, color: '#101210', lineHeight: 27 },
  sheetPrice: { fontFamily: 'monospace', fontSize: 14, color: '#101210', marginTop: 6 },
  sheetStock: { fontSize: 10, color: '#6C6E64', marginTop: 8 },
  sheetQtyRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E3DDD0' },
  sheetQtyLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: '#6C6E64' },
  sheetQtyControls: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  sheetQtyButton: { width: 34, height: 34, borderRadius: 6, borderWidth: 1, borderColor: '#A8A294', alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#F2EFE7' },
  sheetQtyDisabled: { opacity: 0.35 },
  sheetQtyValue: { fontSize: 15, fontWeight: '600' as const, color: '#101210', minWidth: 24, textAlign: 'center' as const },
  sheetTotalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'baseline' as const, marginTop: 14 },
  sheetTotalLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: '#6C6E64' },
  sheetTotalValue: { fontFamily: 'monospace', fontSize: 14, color: '#101210' },
  sheetActions: { flexDirection: 'row' as const, gap: 10, marginTop: 16 },
  sheetSecondary: { flex: 1, borderWidth: 1, borderColor: '#101210', borderRadius: 8, paddingVertical: 14, alignItems: 'center' as const },
  sheetSecondaryText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: '#101210' },
  sheetPrimary: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: '#101210', borderRadius: 8, paddingVertical: 14 },
  sheetPrimaryText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: '#FFFDF8' },
  sheetDetails: { alignItems: 'center' as const, paddingTop: 14 },
  sheetDetailsText: { fontFamily: 'monospace', fontSize: 10, color: '#1E34E8', letterSpacing: 0.6, textDecorationLine: 'underline' as const },
  buttonDisabled: { opacity: 0.45 },
});
