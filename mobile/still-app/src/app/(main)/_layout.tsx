import { Tab } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/authStore';
import { Slot } from 'expo-router';

export default function MainLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/sign-in');
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <Tab>
      <Tab.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused, color }: any) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="cart"
        options={{
          title: 'Bag',
          tabBarIcon: ({ focused, color }: any) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused, color }: any) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused, color }: any) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        options={{
          tabBarIcon: ({ focused, color }: any) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={color} />
          ),
          tabBarButton: () => (
            <Slot />
          ),
        }}
      />
    </Tab>
  );
}
