import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

const isWeb = Platform.OS === 'web';
const SECURE_STORE_CHUNK_SIZE = 1800;
const SESSION_STORAGE_KEY = 'kitchen_assistant.auth_session';
const memoryStorage = new Map<string, string>();

function getStorageItem(key: string) {
  if (isWeb && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }

  return memoryStorage.get(key) ?? null;
}

function setStorageItem(key: string, value: string) {
  if (isWeb && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }

  memoryStorage.set(key, value);
}

function removeStorageItem(key: string) {
  if (isWeb && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }

  memoryStorage.delete(key);
}

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
      Array.from({ length: chunkCount }, (_value, index) =>
        SecureStore.deleteItemAsync(getChunkKey(key, index)),
      ),
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
    Array.from({ length: chunkCount }, (_value, index) =>
      SecureStore.getItemAsync(getChunkKey(key, index)),
    ),
  );

  if (chunks.some((chunk) => chunk == null)) {
    return null;
  }

  return chunks.join('');
}

async function setNativeItem(key: string, value: string) {
  await clearChunkedValue(key);

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  await SecureStore.deleteItemAsync(key);
  const chunkCount = Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE);
  const chunks = Array.from({ length: chunkCount }, (_value, index) =>
    value.slice(index * SECURE_STORE_CHUNK_SIZE, (index + 1) * SECURE_STORE_CHUNK_SIZE),
  );

  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(getChunkKey(key, index), chunk),
    ),
  );
  await SecureStore.setItemAsync(getChunkCountKey(key), String(chunkCount));
}

async function removeNativeItem(key: string) {
  await SecureStore.deleteItemAsync(key);
  await clearChunkedValue(key);
}

async function getRawItem(key: string) {
  if (isWeb) {
    return getStorageItem(key);
  }

  return getNativeItem(key);
}

async function setRawItem(key: string, value: string) {
  if (isWeb) {
    setStorageItem(key, value);
    return;
  }

  await setNativeItem(key, value);
}

async function removeRawItem(key: string) {
  if (isWeb) {
    removeStorageItem(key);
    return;
  }

  await removeNativeItem(key);
}

export async function getStoredAuthSession(): Promise<StoredAuthSession | null> {
  const raw = await getRawItem(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as StoredAuthSession;
}

export async function setStoredAuthSession(session: StoredAuthSession) {
  await setRawItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearStoredAuthSession() {
  await removeRawItem(SESSION_STORAGE_KEY);
}
