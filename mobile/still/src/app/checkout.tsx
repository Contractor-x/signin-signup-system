import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/store/authStore';
import { useCart, cartTotal } from '@/store/cartStore';
import { useOrders } from '@/store/ordersStore';
import { useProducts } from '@/store/productsStore';
import { money } from '@/utils/money';

type Method = 'card' | 'wallet' | 'bank_transfer';

type CardOutcome =
  | { kind: 'paid'; brand: string }
  | { kind: 'failed'; message: string }
  | { kind: '3ds'; brand: string };

const TEST_CARDS: Record<string, CardOutcome> = {
  '4242424242424242': { kind: 'paid', brand: 'Visa' },
  '4000000000009995': { kind: 'failed', message: 'Insufficient funds' },
  '4000000000000069': { kind: 'failed', message: 'Expired card' },
  '4000000000009979': { kind: 'failed', message: 'Stolen card (pick up)' },
  '4000000000003220': { kind: '3ds', brand: 'Visa' },
};

const METHODS: { key: Method; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'card', label: 'Card', hint: 'Visa / Mastercard', icon: 'card-outline' },
  { key: 'wallet', label: 'Wallet / USSD', hint: 'Mobile money', icon: 'phone-portrait-outline' },
  { key: 'bank_transfer', label: 'Bank transfer', hint: 'Manual confirmation', icon: 'business-outline' },
];

export default function CheckoutScreen() {
  const user = useAuth((state) => state.user);
  const router = useRouter();
  const items = useCart((state) => state.items);
  const clearCart = useCart((state) => state.clear);
  const createOrder = useOrders((state) => state.createOrder);
  const decrementStock = useProducts((state) => state.decrementStock);

  // Require sign-in before checking out. Guests are sent to the pre-checkout
  // auth screen (same cream colour as the splash screen) with email/password +
  // Google OAuth, then returned here to complete the purchase.
  useEffect(() => {
    if (!user) {
      router.replace('/pre-checkout');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const [name, setName] = useState(user?.username || '');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<Method>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [walletPhone, setWalletPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const [challenge, setChallenge] = useState<{ brand: string; otp: string; error: string } | null>(null);

  const total = useMemo(() => cartTotal(items), [items]);

  const finish = (
    outcome: 'paid' | 'pending_payment' | 'payment_failed',
    opts: { brand?: string; last4?: string; failureMessage?: string } = {},
  ) => {
    const order = createOrder({
      buyerId: user?.id || 'guest',
      buyerName: name.trim(),
      buyerEmail: user?.email || 'guest@still.local',
      shipping: { name: name.trim(), address: address.trim(), phone: phone.trim() },
      items,
      paymentMethod: method,
      cardLast4: opts.last4,
      cardBrand: opts.brand,
      outcome,
      failureMessage: opts.failureMessage,
    });

    items.forEach((item) => decrementStock(item.product_id, item.quantity));
    clearCart();
    router.replace({ pathname: '/receipt', params: { orderId: order.id } });
  };

  const placeOrder = () => {
    if (items.length === 0) {
      Alert.alert('Empty bag', 'Add at least one object before checking out.');
      return;
    }
    if (!name.trim() || !address.trim() || !phone.trim()) {
      Alert.alert('Missing details', 'Please fill in your name, address and phone.');
      return;
    }

    if (method === 'wallet') {
      if (!walletPhone.trim()) {
        Alert.alert('Missing phone', 'Enter the wallet phone number.');
        return;
      }
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        const suffix = walletPhone.replace(/\D/g, '').slice(-1);
        if (suffix === '1') {
          finish('paid', { brand: 'Wallet' });
        } else if (suffix === '3') {
          finish('pending_payment', { brand: 'Wallet' });
        } else {
          finish('payment_failed', { brand: 'Wallet', failureMessage: 'Wallet authorisation declined' });
        }
      }, 700);
      return;
    }

    if (method === 'bank_transfer') {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        finish('pending_payment');
      }, 700);
      return;
    }

    const number = cardNumber.replace(/\s/g, '');
    if (number.length < 15 || !/^\d+$/.test(number)) {
      Alert.alert('Check card', 'Enter a 16-digit test card number.');
      return;
    }
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry.trim())) {
      Alert.alert('Check expiry', 'Use MM/YY format.');
      return;
    }
    if (cvc.trim().length < 3) {
      Alert.alert('Check CVC', 'Enter the 3-digit security code.');
      return;
    }

    const result = TEST_CARDS[number] || {
      kind: 'failed' as const,
      message: 'Test card not recognised. Use 4242 4242 4242 4242.',
    };
    const last4 = number.slice(-4);

    if (result.kind === '3ds') {
      setChallenge({ brand: result.brand, otp: '', error: '' });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (result.kind === 'paid') {
        finish('paid', { brand: result.brand, last4 });
      } else if (result.kind === 'failed') {
        finish('payment_failed', { brand: 'Visa', last4, failureMessage: result.message });
      }
    }, 900);
  };

  const confirmChallenge = () => {
    if (!challenge) return;
    if (challenge.otp.trim() !== '123456') {
      setChallenge({ ...challenge, error: 'Incorrect OTP. The sandbox code is 123456.' });
      return;
    }
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    setChallenge(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      finish('paid', { brand: challenge.brand, last4 });
    }, 700);
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#101210" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.empty}>
          <Ionicons name="bag-outline" size={48} color="#CBC5B7" />
          <Text style={styles.emptyTitle}>Nothing to check out</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/')}>
            <Text style={styles.primaryButtonText}>Browse the collection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (challenge) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setChallenge(null)} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#101210" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>3-D Secure</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.challengeCard}>
          <View style={styles.lockCircle}>
            <Ionicons name="lock-closed" size={24} color="#1E34E8" />
          </View>
          <Text style={styles.challengeTitle}>Verify your payment</Text>
          <Text style={styles.challengeText}>
            {challenge.brand} requires a one-time code for this sandbox payment of {money(total)}.
          </Text>
          <TextInput
            style={styles.otpInput}
            value={challenge.otp}
            onChangeText={(otp) => setChallenge({ ...challenge, otp, error: '' })}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            placeholderTextColor="#A8A294"
          />
          {challenge.error ? <Text style={styles.error}>{challenge.error}</Text> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={confirmChallenge}>
            <Text style={styles.primaryButtonText}>Confirm payment</Text>
          </TouchableOpacity>
          <Text style={styles.challengeHint}>Sandbox OTP: 123456</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#101210" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.orderSummary}>
          <Text style={styles.summaryLabel}>Order total</Text>
          <Text style={styles.summaryTotal}>{money(total)}</Text>
          <Text style={styles.summaryItems}>
            {items.reduce((sum, i) => sum + i.quantity, 0)} objects · free shipping
          </Text>
        </View>

        {!user ? (
          <TouchableOpacity style={styles.guestBanner} onPress={() => router.push('/sign-in')}>
            <Ionicons name="person-circle-outline" size={20} color="#1E34E8" />
            <Text style={styles.guestText}>Checking out as guest. Sign in to save your order.</Text>
            <Ionicons name="arrow-forward" size={16} color="#1E34E8" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery details</Text>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Atelier Sandbox" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="12 Sandbox Street, Lagos" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" keyboardType="phone-pad" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment method</Text>
          {METHODS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodRow, method === m.key && styles.methodRowActive]}
              onPress={() => setMethod(m.key)}
            >
              <Ionicons name={m.icon} size={20} color={method === m.key ? '#1E34E8' : '#6C6E64'} />
              <View style={styles.methodText}>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <Text style={styles.methodHint}>{m.hint}</Text>
              </View>
              <View style={[styles.radio, method === m.key && styles.radioActive]}>
                {method === m.key ? <View style={styles.radioDot} /> : null}
              </View>
            </TouchableOpacity>
          ))}

          {method === 'card' ? (
            <View style={styles.methodBody}>
              <Field
                label="Card number"
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="4242 4242 4242 4242"
                keyboardType="number-pad"
                maxLength={19}
              />
              <View style={styles.row}>
                <View style={styles.half}>
                  <Field label="Expiry" value={expiry} onChangeText={setExpiry} placeholder="12/30" maxLength={5} keyboardType="number-pad" />
                </View>
                <View style={styles.half}>
                  <Field label="CVC" value={cvc} onChangeText={setCvc} placeholder="123" maxLength={4} keyboardType="number-pad" />
                </View>
              </View>
              <View style={styles.hint}>
                <Text style={styles.hintTitle}>Sandbox test cards</Text>
                <Text style={styles.hintText}>4242 4242 4242 4242 — approved</Text>
                <Text style={styles.hintText}>4000 0000 0000 3220 — 3DS (OTP 123456)</Text>
                <Text style={styles.hintText}>4000 0000 0000 9995 — insufficient funds</Text>
              </View>
            </View>
          ) : null}

          {method === 'wallet' ? (
            <View style={styles.methodBody}>
              <Field
                label="Wallet phone"
                value={walletPhone}
                onChangeText={setWalletPhone}
                placeholder="+234 800 000 0001"
                keyboardType="phone-pad"
              />
              <View style={styles.hint}>
                <Text style={styles.hintTitle}>Sandbox wallet numbers</Text>
                <Text style={styles.hintText}>…0001 — approved</Text>
                <Text style={styles.hintText}>…0003 — pending confirmation</Text>
              </View>
            </View>
          ) : null}

          {method === 'bank_transfer' ? (
            <View style={styles.methodBody}>
              <View style={styles.hint}>
                <Text style={styles.hintTitle}>Transfer instructions</Text>
                <Text style={styles.hintText}>Account: SANDBOX PAY LTD</Text>
                <Text style={styles.hintText}>Number: 987654321 · Sandbox Bank</Text>
                <Text style={styles.hintText}>
                  The order stays pending. You can mark it paid from the order screen.
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={placeOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFDF8" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Pay {money(total)}</Text>
              <Ionicons name="lock-closed" size={15} color="#FFFDF8" />
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.sandboxNote}>Sandbox mode — no real money moves. Test cards only.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#A8A294"
        keyboardType={props.keyboardType}
        maxLength={props.maxLength}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F2EFE7' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { width: 38, height: 38, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerTitle: { fontFamily: 'serif', fontSize: 22, color: '#101210' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  orderSummary: { backgroundColor: '#101210', borderRadius: 10, padding: 18, marginBottom: 14 },
  summaryLabel: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#A8A294' },
  summaryTotal: { fontFamily: 'monospace', fontSize: 26, color: '#FFFDF8', marginTop: 4 },
  summaryItems: { fontSize: 11, color: '#CBC5B7', marginTop: 4 },
  guestBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, backgroundColor: '#E6F4FE', borderWidth: 1, borderColor: '#BBDEFB', borderRadius: 8, padding: 12, marginBottom: 14 },
  guestText: { flex: 1, fontSize: 11, color: '#1E34E8' },
  card: { backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 10, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: '#101210', marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: '#6C6E64', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#A8A294', borderRadius: 6, backgroundColor: '#FFFDF8', paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#101210' },
  row: { flexDirection: 'row' as const, gap: 10 },
  half: { flex: 1 },
  methodRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 8, backgroundColor: '#FFFDF8', padding: 12, marginBottom: 8 },
  methodRowActive: { borderColor: '#1E34E8', backgroundColor: '#E6F4FE' },
  methodText: { flex: 1 },
  methodLabel: { fontSize: 13, fontWeight: '600' as const, color: '#101210' },
  methodHint: { fontSize: 10, color: '#6C6E64', marginTop: 1 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#A8A294', alignItems: 'center' as const, justifyContent: 'center' as const },
  radioActive: { borderColor: '#1E34E8' },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1E34E8' },
  methodBody: { marginTop: 6 },
  hint: { backgroundColor: '#ECE8DC', borderRadius: 6, padding: 10, marginTop: 2 },
  hintTitle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' as const, color: '#34372F', marginBottom: 4 },
  hintText: { fontSize: 10, color: '#6C6E64', lineHeight: 16 },
  primaryButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: '#101210', borderRadius: 8, paddingVertical: 16, marginTop: 6 },
  primaryButtonText: { color: '#FFFDF8', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  buttonDisabled: { opacity: 0.6 },
  sandboxNote: { fontSize: 10, color: '#6C6E64', fontFamily: 'monospace', textAlign: 'center' as const, marginTop: 10 },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingBottom: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: '#101210' },
  error: { color: '#A62A1E', fontSize: 12, marginBottom: 10 },
  challengeCard: { margin: 20, backgroundColor: '#FAF8F2', borderWidth: 1, borderColor: '#CBC5B7', borderRadius: 12, padding: 24, alignItems: 'center' as const },
  lockCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E6F4FE', alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12 },
  challengeTitle: { fontFamily: 'serif', fontSize: 24, color: '#101210', marginBottom: 6 },
  challengeText: { fontSize: 13, color: '#6C6E64', textAlign: 'center' as const, lineHeight: 20, marginBottom: 16 },
  otpInput: { width: '100%', borderWidth: 1, borderColor: '#A8A294', borderRadius: 8, backgroundColor: '#FFFDF8', paddingVertical: 14, textAlign: 'center' as const, fontFamily: 'monospace', fontSize: 22, letterSpacing: 8, color: '#101210', marginBottom: 10 },
  challengeHint: { fontSize: 10, color: '#6C6E64', fontFamily: 'monospace', marginTop: 10 },
};
