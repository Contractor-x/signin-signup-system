import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart, cartCount } from '@/store/cartStore';

export default function MainLayout() {
  const items = useCart((state) => state.items);
  const count = cartCount(items);
  const insets = useSafeAreaInsets();

  // Edge-to-edge Android draws the tab bar underneath the gesture pill or the
  // three-button navigation bar. Add the real system inset so the bar always
  // sits above it, whichever navigation mode the device uses.
  const bottomInset = Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tabs
      id="main-tabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1E34E8',
        tabBarInactiveTintColor: '#6C6E64',
        tabBarStyle: {
          backgroundColor: '#FAF8F2',
          borderTopColor: '#CBC5B7',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: {
          fontFamily: 'monospace',
          fontSize: 10,
          letterSpacing: 0.08,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Bag',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: '#1E34E8', color: '#FFFDF8', fontSize: 9 },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'bag-handle' : 'bag-handle-outline'} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
