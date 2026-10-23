import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/authStore';
import { money } from '@/utils/money';

export default function CheckoutScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | 'bank_transfer'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [walletPhone, setWalletPhone] = useState('');

  const METHODS: { key: 'card' | 'wallet' | 'bank_transfer'; label: string; icon: string }[] = [
    { key: 'card', label: 'Card', icon: 'card' },
    { key: 'wallet', label: 'Wallet / USSD', icon: 'call' },
    { key: 'bank_transfer', label: 'Bank Transfer', icon: 'banknote' },
  ];

  const handlePlaceOrder = async () => {
    if (!name || !address || !phone) {
      Alert.alert('Missing details', 'Please fill in name, address and phone.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create order via Supabase (edge function or direct)
      // For MVP, we simulate: create a payment intent via Supabase function
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: 0, // will be set from cart
          currency: 'NGN',
          payment_method: paymentMethod,
          cardNumber,
          expMonth,
          expYear,
          cvc,
          walletPhone,
        },
      });
      if (error) throw error;

      // 2. Navigate to receipt
      router.push('/receipt', {
        orderId: data?.order_id || 'ord_demo',
        total: 0,
        paymentMethod,
        status: data?.status || 'pending_payment',
      });
    } catch (err: any) {
      Alert.alert('Checkout failed', err.message || 'Could not place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSub}>Delivery and payment</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery details</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Atelier Sandbox" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="12 Sandbox Street, Lagos" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+234 800 000 0000" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment method</Text>
          {METHODS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodRow, paymentMethod === m.key && styles.methodRowActive]}
              onPress={() => setPaymentMethod(m.key)}
            >
              <Ionicons name={m.icon} size={20} color={paymentMethod === m.key ? '#1E34E8' : '#6C6E64'} />
              <Text style={styles.methodLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}

          {paymentMethod === 'card' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Card number</Text>
                <TextInput style={styles.input} value={cardNumber} onChangeText={setCardNumber} keyboardType="numeric" placeholder="4242 4242 4242 4242" maxLength={19} />
              </View>
              <View style={styles.cardExpiryRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Exp MM</Text>
                  <TextInput style={styles.input} value={expMonth} onChangeText={setExpMonth} keyboardType="numeric" placeholder="12" maxLength={2} />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Exp YY</Text>
                  <TextInput style={styles.input} value={expYear} onChangeText={setExpYear} keyboardType="numeric" placeholder="30" maxLength={2} />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>CVC</Text>
                <TextInput style={styles.input} value={cvc} onChangeText={setCvc} keyboardType="numeric" placeholder="123" maxLength={4} />
              </View>
            </>
          )}

          {paymentMethod === 'wallet' && (
            <View style={styles.field}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput style={styles.input} value={walletPhone} onChangeText={setWalletPhone} keyboardType="phone-pad" placeholder="+234 800 000 0000" />
              <Text style={styles.fieldHint}>Test: +2348000000001 (approved), +2348000000003 (pending)</Text>
            </View>
          )}

          {paymentMethod === 'bank_transfer' && (
            <View style={styles.fieldHint}>
              <Text style={styles.fieldHintTitle}>Bank transfer instructions</Text>
              <Text style={styles.fieldHintText}>
                Account: SANDBOX PAY LTD{'\n'}
                Account number: 987654321{'\n'}
                Bank: Sandbox Bank{'\n\n'}
                After transfer, the order will settle asynchronously. Use the simulator in Orders to confirm.
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={[styles.placeButton, loading && styles.buttonDisabled]} onPress={handlePlaceOrder} disabled={loading}>
          <Text style={styles.placeButtonText}>{loading ? 'Placing order…' : 'Place order'}</Text>
        </TouchableOpacity>

        <Text style={styles.sandboxNote}>Sandbox mode — no real money moves. Test cards available.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16 },
  header: { marginBottom: 16 },
  headerTitle: { fontFamily: 'Instrument Serif', fontSize: 28, fontWeight: '400', color: '#101210' },
  headerSub: { fontSize: 13, color: '#6C6E64' },
  card: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#101210', marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontFamily: 'IBM Plex Mono', fontSize: 10, letterSpacing: 0.14, textTransform: 'uppercase', color: '#6C6E64', marginBottom: 7 },
  input: { width: '100%', padding: 12, borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, backgroundColor: '#FFFDF8', fontSize: 15, color: '#101210', fontFamily: 'Inter' },
  cardExpiryRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#CBC5B7', backgroundColor: '#FFFDF8', marginBottom: 8 },
  methodRowActive: { borderColor: '#1E34E8', backgroundColor: '#E6F4FE' },
  methodLabel: { marginLeft: 12, fontSize: 14, color: '#101210', fontWeight: '500' },
  placeButton: { backgroundColor: '#101210', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  placeButtonText: { color: '#FFFDF8', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0.16, textTransform: 'uppercase' },
  buttonDisabled: { opacity: 0.6 },
  sandboxNote: { fontSize: 11, color: '#6C6E64', fontFamily: 'IBM Plex Mono', marginTop: 10, textAlign: 'center' },
  fieldHint: { marginTop: 8, padding: 10, backgroundColor: '#E6F4FE', borderRadius: 6, borderWidth: 1, borderColor: '#BBDEFB' },
  fieldHintTitle: { fontSize: 11, fontFamily: 'IBM Plex Mono', fontWeight: '600', color: '#1E34E8', marginBottom: 4 },
  fieldHintText: { fontSize: 11, color: '#34372F', lineHeight: 16 },
};
