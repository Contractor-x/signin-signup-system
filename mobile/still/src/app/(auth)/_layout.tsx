import React from 'react';
import { Redirect, Slot, usePathname } from 'expo-router';
import { useAuth } from '@/store/authStore';

export default function AuthLayout() {
  const user = useAuth((state) => state.user);
  const pathname = usePathname();

  // The pre-checkout screen needs to stay mounted for the hand-off to
  // /checkout after sign-in. All other auth screens can redirect immediately.
  if (user && pathname !== '/pre-checkout') {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
