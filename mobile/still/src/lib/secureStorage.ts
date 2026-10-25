import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Zustand persistence backed by the platform keychain/keystore on native.
 * (Web is not a target for the app build; localStorage is only a safety net.)
 */
export const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (Platform.OS === 'web') {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(name);
    }
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(name, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Storage failures should never break the UI.
    }
  },
  removeItem: async (name) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(name);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // ignore
    }
  },
};
