import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isWeb = Platform.OS === 'web';

const storage = {
  async getItem(key: string) {
    if (isWeb) return Promise.resolve(localStorage.getItem(key));
    const value = await SecureStore.getItemAsync(key);
    return value ?? null;
  },
  async setItem(key: string, value: string) {
    if (isWeb) return Promise.resolve(localStorage.setItem(key, value));
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (isWeb) {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    detectSessionInUrl: false,
  },
});

export default supabase;
