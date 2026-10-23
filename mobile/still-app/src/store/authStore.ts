import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase, UserRole } from '../services/supabase';

interface AuthState {
  user: { id: string; email: string; username: string; role: UserRole } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (token: string, newPassword: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
}

// SecureStore-backed middleware for zustand on native
const secureStorage = Platform.OS === 'web'
  ? createJSONStorage(() => localStorage)
  : createJSONStorage(() => SecureStore, { name: 'still-auth' });

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,

      setLoading: (loading) => set({ loading }),

      signIn: async (email: string, password: string) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password,
          });
          if (error) throw error;
          if (data.user) {
            set({
              user: {
                id: data.user.id,
                email: data.user.email!,
                username: data.user.user_metadata.username || data.user.email!.split('@')[0],
                role: (data.user.app_metadata?.role as UserRole) || 'customer',
              },
            });
          }
        } finally {
          set({ loading: false });
        }
      },

      signUp: async (email: string, password: string, username: string) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email: email.toLowerCase().trim(),
            password,
            options: {
              data: { username },
            },
          });
          if (error) throw error;
          if (data.user) {
            set({
              user: {
                id: data.user.id,
                email: data.user.email!,
                username,
                role: 'customer',
              },
            });
          }
        } finally {
          set({ loading: false });
        }
      },

      signInWithGoogle: async () => {
        set({ loading: true });
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: 'still-app://auth-callback',
              queryParams: {
                // Google OAuth placeholders — replace with real client IDs
                // client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
              },
            },
          });
          if (error) throw error;
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        set({ loading: true });
        try {
          await supabase.auth.signOut();
          set({ user: null });
        } finally {
          set({ loading: false });
        }
      },

      fetchProfile: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          set({ user: null });
          return;
        }
        set({
          user: {
            id: user.id,
            email: user.email!,
            username: user.user_metadata.username || user.email!.split('@')[0],
            role: (user.app_metadata?.role as UserRole) || 'customer',
          },
        });
      },

      resetPassword: async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
          redirectTo: 'still-app://reset-password',
        });
        if (error) throw error;
      },

      updatePassword: async (token: string, newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      },
    }),
    {
      name: 'still-auth-storage',
      storage: secureStorage,
      partialize: (state) => ({ user: state.user }),
    }
  )
);
