import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { money } from '@/utils/money';

export default function SellerScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    loadSellerData();
  }, []);

  const loadSellerData = async () => {
    setLoading(true);
    try {
      const [prodRes, sumRes] = await Promise.all([
        supabase.from('products').select('*').eq('seller_id', user?.id).order('created_at', { ascending: false }),
        supabase.rpc('seller_summary', { seller_id: user?.id }).catch(() => null),
      ]);
      if (prodRes.error) throw prodRes.error;
      setProducts(prodRes.data || []);
      if (sumRes?.data) setSummary(sumRes.data);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seller Dashboard</Text>
        <Text style={styles.headerSub}>Manage your products and sales</Text>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="#101210" /></View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={styles.summaryValue}>{money(summary?.paid_minor ?? 0)}</Text>
            <Text style={styles.summaryLabel}>Refunded</Text>
            <Text style={styles.summaryValue}>{money(summary?.refunded_minor ?? 0)}</Text>
            <Text style={styles.summaryLabel}>Awaiting payment</Text>
            <Text style={styles.summaryValue}>{money(summary?.awaiting_payment_minor ?? 0)}</Text>
          </View>

          <View style={styles.addProduct}>
            <View style={styles.addRow}>
              <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Product name" />
              <TextInput style={styles.inputPrice} value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" placeholder="Price (minor units)" />
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => {}}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.productsTitle}>Your products ({products.length})</Text>
          <FlatList
            data={products}
            renderItem={({ item }) => <ProductRow product={item} onDelete={() => {}} />}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function ProductRow({ product, onDelete }: { product: any; onDelete: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMedia}>
        <Text style={styles.emoji}>{product.emoji || '📦'}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{product.name}</Text>
        <Text style={styles.rowMeta}>{product.category} • {money(product.price_minor)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowStock}>{product.stock} in stock</Text>
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
  summaryCard: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 16, marginHorizontal: 20, marginBottom: 16 },
  summaryLabel: { fontSize: 10, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', color: '#6C6E64', marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '600', fontFamily: 'IBM Plex Mono', color: '#101210', marginBottom: 10 },
  addProduct: { marginHorizontal: 20, marginBottom: 16 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { flex: 2, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, padding: 12, fontSize: 14, color: '#101210' },
  inputPrice: { flex: 1, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, padding: 12, fontSize: 14, color: '#101210' },
  addButton: { backgroundColor: '#101210', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 10 },
  addButtonText: { color: '#FFFDF8', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase' },
  productsTitle: { fontSize: 15, fontWeight: '600', color: '#101210', marginHorizontal: 20, marginBottom: 10 },
  listContent: { paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: 'row', backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 12, marginBottom: 10, alignItems: 'center' },
  rowMedia: { width: 50, height: 50, backgroundColor: '#E6E1D5', borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  emoji: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#101210', marginBottom: 2 },
  rowMeta: { fontSize: 12, color: '#6C6E64', fontFamily: 'IBM Plex Mono' },
  rowRight: { alignItems: 'flex-end' },
  rowStock: { fontSize: 12, color: '#6C6E64', fontFamily: 'IBM Plex Mono' },
};
