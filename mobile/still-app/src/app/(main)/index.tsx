import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase, isAtLeast } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { money } from '@/utils/money';

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  stock: number;
  emoji: string;
  image_url: string;
  category: string;
  active: boolean;
  seller?: string;
};

const CATEGORIES = ['All', 'Furniture', 'Lighting', 'Textiles', 'Ceramics', 'Apothecary', 'Kitchen', 'Objects'];

export default function StoreScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('products')
        .select('*, profiles(username)')
        .eq('active', true);

      if (selectedCategory && selectedCategory !== 'All') {
        queryBuilder = queryBuilder.eq('category', selectedCategory);
      }

      if (query.trim()) {
        queryBuilder = queryBuilder.ilike('name', `%${query.trim()}%`);
      }

      const sortMap: Record<string, { column: string; ascending: boolean }> = {
        featured: { column: 'created_at', ascending: false },
        newest: { column: 'created_at', ascending: false },
        price_asc: { column: 'price_minor', ascending: true },
        price_desc: { column: 'price_minor', ascending: false },
        name_asc: { column: 'name', ascending: true },
      };
      const s = sortMap[sort] || sortMap['featured'];
      queryBuilder = queryBuilder.order(s.column, { ascending: s.ascending });

      const { data, error } = await queryBuilder.limit(100);

      if (error) throw error;

      const mapped: Product[] = (data || []).map((row: any) => ({
        id: row.id,
        seller_id: row.seller_id,
        name: row.name,
        description: row.description,
        price_minor: row.price_minor,
        currency: row.currency,
        stock: row.stock,
        emoji: row.emoji,
        image_url: row.image_url,
        category: row.category,
        active: row.active,
        seller: row.profiles?.username,
      }));

      setProducts(mapped);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, selectedCategory, sort]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
  };

  const handlePress = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>STILL</Text>
        <Text style={styles.subtitle}>Objects for living</Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search objects…"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchButton} onPress={fetchProducts}>
          <Ionicons name="search" size={20} color="#101210" />
        </TouchableOpacity>
      </View>

      <View style={styles.categorySection}>
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.categoryList}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.sortSection}>
        <Text style={styles.sectionTitle}>Sort</Text>
        <View style={styles.sortList}>
          {['featured', 'newest', 'price_asc', 'price_desc', 'name_asc'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sortChip, sort === s && styles.sortChipActive]}
              onPress={() => setSort(s)}
            >
              <Text style={[styles.sortChipText, sort === s && styles.sortChipTextActive]}>
                {s.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.productsSection}>
        <Text style={styles.productsTitle}>Collection</Text>

        {loading ? (
          <View style={styles.skeletonList}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonMedia} />
                <View style={styles.skeletonLine} />
                <View style={[styles.skeletonLine, styles.skeletonShort]} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={products}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
                <View style={styles.media}>
                  <Image source={{ uri: String(item.image_url || '') }} style={styles.image} />
                  <View style={styles.emojiBadge}>{item.emoji}</View>
                  {item.stock === 0 && (
                    <View style={styles.soldOutOverlay}>
                      <Text style={styles.soldOutText}>Sold out</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardPrice}>{money(item.price_minor, item.currency)}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardStock}>{item.stock} in stock</Text>
                    <Text style={styles.cardCategory}>{item.category}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No objects found.</Text>
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {user && user.role !== 'customer' && (
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/seller')}>
          <Text style={styles.addButtonText}>+ Add product</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  appTitle: { fontFamily: 'Instrument Serif', fontSize: 30, fontWeight: '400', color: '#101210' },
  subtitle: { fontSize: 13, color: '#6C6E64' },
  searchBar: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#101210' },
  searchButton: { padding: 10 },
  categorySection: { paddingHorizontal: 16, marginBottom: 8 },
  categoryList: { flexDirection: 'row', gap: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#A8A294', borderRadius: 20, backgroundColor: '#FFFDF8' },
  categoryChipActive: { borderColor: '#1E34E8', backgroundColor: '#E6F4FE' },
  categoryChipText: { fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  categoryChipTextActive: { color: '#1E34E8', fontWeight: '600' },
  sortSection: { paddingHorizontal: 16, marginBottom: 8 },
  sortList: { flexDirection: 'row', gap: 6 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 16, backgroundColor: '#FFFDF8' },
  sortChipActive: { borderColor: '#1E34E8', backgroundColor: '#E6F4FE' },
  sortChipText: { fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#34372F' },
  sortChipTextActive: { color: '#1E34E8', fontWeight: '600' },
  productsSection: { paddingHorizontal: 16 },
  productsTitle: { fontSize: 16, fontWeight: '600', color: '#101210', marginBottom: 10 },
  productsList: { paddingBottom: 80 },
  card: { marginBottom: 14, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, overflow: 'hidden' },
  media: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#E6E1D5', borderRadius: 8, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%', borderRadius: 8 },
  emojiBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,253,248,0.9)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  soldOutOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  soldOutText: { color: '#FFFDF8', fontSize: 12, fontWeight: '600' },
  cardBody: { paddingTop: 8 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#101210', marginBottom: 2 },
  cardPrice: { fontSize: 14, fontFamily: 'IBM Plex Mono', color: '#34372F', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardStock: { fontSize: 11, color: '#6C6E64' },
  cardCategory: { fontSize: 11, color: '#6C6E64' },
  skeletonList: { gap: 12, paddingVertical: 20 },
  skeletonCard: { flexDirection: 'row', gap: 12, paddingHorizontal: 4 },
  skeletonMedia: { width: 100, height: 132, backgroundColor: '#E6E1D5', borderRadius: 8 },
  skeletonLine: { height: 10, backgroundColor: '#E6E1D5', borderRadius: 4, marginTop: 8 },
  skeletonShort: { width: '60%', marginTop: 6 },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#6C6E64' },
  addButton: { position: 'absolute', right: 16, bottom: 100, backgroundColor: '#101210', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addButtonText: { color: '#FFFDF8', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase' },
};
