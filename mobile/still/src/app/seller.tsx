import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IS_DEMO } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { useProducts } from '@/store/productsStore';
import { useOrders } from '@/store/ordersStore';
import { money } from '@/utils/money';

const CATEGORIES = ['Furniture', 'Kitchen', 'Objects', 'Apparel', 'Carry', 'Apothecary'];

export default function SellerScreen() {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const products = useProducts((state) => state.products);
  const addProduct = useProducts((state) => state.addProduct);
  const removeProduct = useProducts((state) => state.removeProduct);
  const orders = useOrders((state) => state.orders);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('Objects');

  const mine = useMemo(() => {
    if (!user) return [];
    if (IS_DEMO && (user.id === 'usr_admin' || user.role === 'superuser')) return products;
    return products.filter((p) => p.seller_id === user.id);
  }, [products, user]);

  const summary = useMemo(() => {
    const paid = orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + o.total_minor, 0);
    const pending = orders
      .filter((o) => o.status === 'pending_payment')
      .reduce((sum, o) => sum + o.total_minor, 0);
    return { paid, pending };
  }, [orders]);

  const handleAdd = () => {
    const priceNumber = Number(price.replace(/[^0-9.]/g, ''));
    const stockNumber = Number(stock.replace(/[^0-9]/g, ''));
    if (!name.trim()) {
      Alert.alert('Missing name', 'Give the object a name.');
      return;
    }
    if (!priceNumber || priceNumber <= 0) {
      Alert.alert('Check price', 'Enter a price in naira, e.g. 24000.');
      return;
    }
    addProduct(user?.id || 'usr_studio', user?.username || 'Atelier Sandbox', {
      name,
      price_minor: Math.round(priceNumber * 100),
      stock: Number.isFinite(stockNumber) ? stockNumber : 10,
      category,
    });
    setName('');
    setPrice('');
    setStock('10');
    setShowForm(false);
  };

  const handleRemove = (id: string, productName: string) => {
    Alert.alert('Remove object', `Remove “${productName}” from the shop?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeProduct(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#101210" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seller</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => setShowForm((v) => !v)} hitSlop={8}>
          <Ionicons name={showForm ? 'close' : 'add'} size={24} color="#101210" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Atelier Sandbox</Text>
          <Text style={styles.heroSub}>
            {IS_DEMO ? 'Sandbox shop · local catalogue' : 'Your shop'}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Paid</Text>
            <Text style={styles.statValue}>{money(summary.paid)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Awaiting</Text>
            <Text style={styles.statValue}>{money(summary.pending)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Objects</Text>
            <Text style={styles.statValue}>{mine.length}</Text>
          </View>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New object</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Linen Table Runner"
              placeholderTextColor="#A8A294"
            />
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Price (₦)</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="24000"
                  placeholderTextColor="#A8A294"
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Stock</Text>
                <TextInput
                  style={styles.input}
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="number-pad"
                  placeholder="10"
                  placeholderTextColor="#A8A294"
                />
              </View>
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryWrap}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAdd}>
              <Text style={styles.primaryButtonText}>Add to shop</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Your objects ({mine.length})</Text>

        {mine.map((product) => (
          <View key={product.id} style={styles.row}>
            <View style={styles.rowMedia}>
              <Text style={styles.emoji}>{product.emoji}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{product.name}</Text>
              <Text style={styles.rowMeta}>
                {product.category} · {money(product.price_minor)} · {product.stock} in stock
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(product.id, product.name)} hitSlop={8}>
              <Ionicons name="trash-outline" size={17} color="#A62A1E" />
            </TouchableOpacity>
          </View>
        ))}

        {mine.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No objects yet. Add your first one above.</Text>
          </View>
        ) : null}
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
  hero: { paddingVertical: 10, marginBottom: 6 },
  heroTitle: { fontFamily: 'serif', fontSize: 30, color: '#101210' },
  heroSub: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#6C6E64', marginTop: 2 },
  statsRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 12 },
  statLabel: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 4 },
  statValue: { fontFamily: 'monospace', fontSize: 13, color: '#101210', fontWeight: '700' as const },
  formCard: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 10, padding: 16, marginBottom: 18 },
  formTitle: { fontFamily: 'serif', fontSize: 22, color: '#101210', marginBottom: 12 },
  label: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, backgroundColor: '#FFFDF8', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#101210', marginBottom: 12 },
  formRow: { flexDirection: 'row' as const, gap: 10 },
  formHalf: { flex: 1 },
  categoryWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 14 },
  categoryChip: { borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFFDF8' },
  categoryChipActive: { borderColor: '#1E34E8', backgroundColor: '#E6F4FE' },
  categoryText: { fontSize: 10, fontFamily: 'monospace', color: '#34372F' },
  categoryTextActive: { color: '#1E34E8' },
  primaryButton: { backgroundColor: '#101210', borderRadius: 6, paddingVertical: 13, alignItems: 'center' as const },
  primaryButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  sectionTitle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 10 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 10, marginBottom: 8, gap: 10 },
  rowMedia: { width: 42, height: 42, borderRadius: 6, backgroundColor: '#E6E1D5', alignItems: 'center' as const, justifyContent: 'center' as const },
  emoji: { fontSize: 20 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '600' as const, color: '#101210' },
  rowMeta: { fontSize: 9, fontFamily: 'monospace', color: '#6C6E64', marginTop: 2 },
  empty: { paddingVertical: 24, alignItems: 'center' as const },
  emptyText: { fontSize: 12, color: '#6C6E64' },
};
