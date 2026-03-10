import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isWeb = Platform.OS === 'web';
const SECURE_STORE_CHUNK_SIZE = 1800;

function getChunkCountKey(key: string) {
  return `${key}.chunk_count`;
}

function getChunkKey(key: string, index: number) {
  return `${key}.chunk_${index}`;
}

async function getChunkCount(key: string) {
  const value = await SecureStore.getItemAsync(getChunkCountKey(key));

  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function clearChunkedValue(key: string) {
  const chunkCount = await getChunkCount(key);

  if (chunkCount > 0) {
    await Promise.all(
      Array.from({ length: chunkCount }, (_value, index) => SecureStore.deleteItemAsync(getChunkKey(key, index))),
    );
  }

  await SecureStore.deleteItemAsync(getChunkCountKey(key));
}

async function getNativeItem(key: string) {
  const chunkCount = await getChunkCount(key);

  if (chunkCount === 0) {
    return (await SecureStore.getItemAsync(key)) ?? null;
  }

  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_value, index) => SecureStore.getItemAsync(getChunkKey(key, index))),
  );

  if (chunks.some((chunk) => chunk == null)) {
    return null;
  }

  return chunks.join('');
}

async function setNativeItem(key: string, value: string) {
  await clearChunkedValue(key);

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    return SecureStore.setItemAsync(key, value);
  }

  await SecureStore.deleteItemAsync(key);

  const chunkCount = Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE);
  const chunks = Array.from({ length: chunkCount }, (_value, index) =>
    value.slice(index * SECURE_STORE_CHUNK_SIZE, (index + 1) * SECURE_STORE_CHUNK_SIZE),
  );

  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(getChunkKey(key, index), chunk)));
  await SecureStore.setItemAsync(getChunkCountKey(key), String(chunkCount));
}

async function removeNativeItem(key: string) {
  await SecureStore.deleteItemAsync(key);
  await clearChunkedValue(key);
}

export const authStorage = {
  async getItem(key: string) {
    if (isWeb) return Promise.resolve(localStorage.getItem(key));
    return getNativeItem(key);
  },
  async setItem(key: string, value: string) {
    if (isWeb) return Promise.resolve(localStorage.setItem(key, value));
    return setNativeItem(key, value);
  },
  async removeItem(key: string) {
    if (isWeb) {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    return removeNativeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    detectSessionInUrl: false,
  },
});

export default supabase;
