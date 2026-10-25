import React from 'react';
import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/store/authStore';

export default function AuthLayout() {
  const user = useAuth((state) => state.user);

  if (user) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
