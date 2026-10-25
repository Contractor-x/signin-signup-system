import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AUTH_DEMO, supabase, UserRole } from '../services/supabase';
import { DEMO_ACCOUNTS, type DemoAccount } from '../data/demo';
import { secureStorage } from '../lib/secureStorage';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
};

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (token: string, newPassword: string) => Promise<void>;
}

// Demo accounts are mutable for the session so a new sign-up can sign in.
const demoAccounts: DemoAccount[] = [...DEMO_ACCOUNTS];

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: false,

      signIn: async (email, password) => {
        set({ loading: true });
        try {
          if (AUTH_DEMO) {
            const normalized = email.trim().toLowerCase();
            const account = demoAccounts.find((a) => a.email === normalized);
            if (!account || account.password !== password) {
              throw new Error('Invalid email or password.');
            }
            set({
              user: {
                id: account.id,
                email: account.email,
                username: account.username,
                role: account.role,
              },
            });
            return;
          }

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

      signUp: async (email, password, username) => {
        set({ loading: true });
        try {
          if (AUTH_DEMO) {
            const normalized = email.trim().toLowerCase();
            if (demoAccounts.some((a) => a.email === normalized)) {
              throw new Error('An account with this email already exists.');
            }
            const account: DemoAccount = {
              id: `usr_${Date.now().toString(36)}`,
              email: normalized,
              username: username.trim() || normalized.split('@')[0],
              password,
              role: 'customer',
            };
            demoAccounts.push(account);
            set({
              user: {
                id: account.id,
                email: account.email,
                username: account.username,
                role: account.role,
              },
            });
            return;
          }

          const { data, error } = await supabase.auth.signUp({
            email: email.toLowerCase().trim(),
            password,
            options: { data: { username } },
          });
          if (error) throw error;
          if (!data.session) {
            throw new Error('Check your email to confirm your account, then sign in.');
          }
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
          if (AUTH_DEMO) {
            set({
              user: {
                id: 'usr_customer',
                email: 'customer@still.local',
                username: 'customer',
                role: 'customer',
              },
            });
            return;
          }

          const redirectTo = Linking.createURL('auth-callback');
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo,
              skipBrowserRedirect: true,
            },
          });
          if (error) throw error;
          if (!data.url) throw new Error('Google sign-in is not configured yet.');

          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (result.type !== 'success') return;

          const { queryParams } = Linking.parse(result.url);
          const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
          const accessToken =
            typeof queryParams?.access_token === 'string' ? queryParams.access_token : null;
          const refreshToken =
            typeof queryParams?.refresh_token === 'string' ? queryParams.refresh_token : null;
          const oauthError =
            typeof queryParams?.error_description === 'string'
              ? queryParams.error_description
              : typeof queryParams?.error === 'string'
                ? queryParams.error
                : null;

          if (oauthError) throw new Error(oauthError);

          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
          } else if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          } else {
            throw new Error('Google sign-in did not return a session.');
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            set({
              user: {
                id: user.id,
                email: user.email!,
                username: user.user_metadata.username || user.email!.split('@')[0],
                role: (user.app_metadata?.role as UserRole) || 'customer',
              },
            });
          }
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        set({ loading: true });
        try {
          if (!AUTH_DEMO) {
            await supabase.auth.signOut();
          }
          set({ user: null });
        } finally {
          set({ loading: false });
        }
      },

      fetchProfile: async () => {
        if (AUTH_DEMO) return;
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

      resetPassword: async (email) => {
        if (AUTH_DEMO) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
          redirectTo: 'stillapp://reset-password',
        });
        if (error) throw error;
      },

      updatePassword: async (_token, newPassword) => {
        if (AUTH_DEMO) return;
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      },
    }),
    {
      name: 'still-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
