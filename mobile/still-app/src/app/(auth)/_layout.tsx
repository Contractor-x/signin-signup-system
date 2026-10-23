import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/authStore';
import { Slot } from 'expo-router';

export default function AuthLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(main)');
    }
  }, [user, loading, router]);

  if (loading) return null;

  return <Slot />;
}
