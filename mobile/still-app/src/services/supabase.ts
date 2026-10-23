import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/*
 * Supabase configuration for STILL app.
 *
 * Required environment variables (expo also reads .env):
 *   EXPO_PUBLIC_SUPABASE_URL   - https://<project-ref>.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY - public anon key
 *
 * Google OAuth placeholders (fill in from Google Cloud Console):
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID    - web client ID (for signInWithOAuth)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID    - iOS client ID
 *   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID - Android client ID
 *
 * The backend (FastAPI) can remain as a payment-sandbox proxy. Point it at
 * EXPO_PUBLIC_API_BASE_URL if you keep running it separately.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ohshsuoojyvotofopbjp.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'PLACEHOLDER_ANON_KEY';

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

// Google OAuth client IDs (placeholders — replace with real values)
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'GOOGLE_WEB_CLIENT_ID_PLACEHOLDER';
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'GOOGLE_IOS_CLIENT_ID_PLACEHOLDER';
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'GOOGLE_ANDROID_CLIENT_ID_PLACEHOLDER';

// Optional FastAPI payment-sandbox backend (keep if you run the sandbox separately)
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:8000'; // Android emulator localhost

// SecureStore key for the Supabase refresh token
const REFRESH_TOKEN_KEY = 'supabase_refresh_token';

/**
 * Create a Supabase client with SecureStore token persistence.
 * Works on iOS, Android, and Expo Web.
 */
export function createSupabaseClient(): SupabaseClient {
  const options: Parameters<typeof createClient>[2] = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  };

  // On native, use SecureStore to persist the session instead of localStorage
  if (Platform.OS !== 'web') {
    options.storage = {
      getItem: async (key: string) => {
        try {
          return await SecureStore.getItemAsync(key);
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch {
          // ignore
        }
      },
      removeItem: async (key: string) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          // ignore
        }
      },
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, options);
}

export const supabase = createSupabaseClient();

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; username: string; role: string; avatar_url: string | null; created_at: string };
        Insert: { id?: string; email: string; username: string; role?: string; avatar_url?: string | null; created_at?: string };
        Update: { id?: string; email?: string; username?: string; role?: string; avatar_url?: string | null; created_at?: string };
      };
      products: {
        Row: { id: string; seller_id: string; name: string; description: string; price_minor: number; currency: string; stock: number; emoji: string; image_url: string; category: string; active: boolean; created_at: string };
        Insert: { id?: string; seller_id: string; name: string; description?: string; price_minor: number; currency?: string; stock?: number; emoji?: string; image_url?: string; category?: string; active?: boolean; created_at?: string };
        Update: { id?: string; seller_id?: string; name?: string; description?: string; price_minor?: number; currency?: string; stock?: number; emoji?: string; image_url?: string; category?: string; active?: boolean; created_at?: string };
      };
      orders: {
        Row: { id: string; buyer_id: string; total_minor: number; currency: string; status: string; intent_id: string | null; shipping: any; created_at: string };
        Insert: { id?: string; buyer_id: string; total_minor: number; currency?: string; status?: string; intent_id?: string | null; shipping?: any; created_at?: string };
        Update: { id?: string; buyer_id?: string; total_minor?: number; currency?: string; status?: string; intent_id?: string | null; shipping?: any; created_at?: string };
      };
      order_items: {
        Row: { id: number; order_id: string; product_id: string; seller_id: string; name: string; unit_minor: number; quantity: number };
        Insert: { id?: number; order_id: string; product_id: string; seller_id: string; name: string; unit_minor: number; quantity: number };
        Update: { id?: number; order_id?: string; product_id?: string; seller_id?: string; name?: string; unit_minor?: number; quantity?: number };
      };
      payment_intents: {
        Row: { id: string; merchant_id: string; amount: number; currency: string; status: string; description: string | null; metadata: any; payment_method: any | null; failure_code: string | null; failure_message: string | null; next_action: any | null; amount_refunded: number; client_secret: string | null; created_at: string };
        Insert: { id?: string; merchant_id: string; amount: number; currency?: string; status?: string; description?: string | null; metadata?: any; payment_method?: any | null; failure_code?: string | null; failure_message?: string | null; next_action?: any | null; amount_refunded?: number; client_secret?: string | null; created_at?: string };
        Update: { id?: string; merchant_id?: string; amount?: number; currency?: string; status?: string; description?: string | null; metadata?: any; payment_method?: any | null; failure_code?: string | null; failure_message?: string | null; next_action?: any | null; amount_refunded?: number; client_secret?: string | null; created_at?: string };
      };
      refunds: {
        Row: { id: string; merchant_id: string; intent_id: string; amount: number; status: string; reason: string | null; created_at: string };
        Insert: { id?: string; merchant_id: string; intent_id: string; amount: number; status?: string; reason?: string | null; created_at?: string };
        Update: { id?: string; merchant_id?: string; intent_id?: string; amount?: number; status?: string; reason?: string | null; created_at?: string };
      };
    };
  };
};

export type UserRole = 'customer' | 'shop_owner' | 'superuser';

export const ROLES: UserRole[] = ['customer', 'shop_owner', 'superuser'];

export function isAtLeast(userRole: UserRole | undefined | null, required: UserRole): boolean {
  if (!userRole) return false;
  return ROLES.indexOf(userRole) >= ROLES.indexOf(required);
}
