import { Platform } from 'react-native';
import axios, { AxiosRequestConfig } from 'axios';
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
  type StoredAuthSession,
} from './authSession';

const isWeb = Platform.OS === 'web';
const isAndroid = Platform.OS === 'android';
const DEFAULT_LOCAL = 'http://localhost:3000';
const DEFAULT_ANDROID_EMULATOR = 'http://10.0.2.2:3000';
const DEFAULT_BASE_URL = isAndroid ? DEFAULT_ANDROID_EMULATOR : DEFAULT_LOCAL;
export const BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? (isWeb ? DEFAULT_LOCAL : DEFAULT_BASE_URL);
export const API_BASE_URL = `${BASE_URL}/api/v1`;

type ApiOptions = AxiosRequestConfig & { skipAuth?: boolean; _retry?: boolean };

async function getAuthHeader() {
  const session = await getStoredAuthSession();
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<StoredAuthSession> | null = null;

async function refreshSession(): Promise<StoredAuthSession> {
  const existing = await getStoredAuthSession();

  if (!existing?.refreshToken) {
    throw new Error('Authentication required.');
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await axiosInstance.request({
          url: '/auth/refresh',
          method: 'post',
          data: { refreshToken: existing.refreshToken },
        });
        const session = response.data as StoredAuthSession;
        await setStoredAuthSession(session);
        return session;
      } catch (error) {
        await clearStoredAuthSession();
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiRequest(path: string, options: ApiOptions = {}) {
  const { skipAuth, _retry, ...axiosOpts } = options;
  const headers = { ...((axiosOpts.headers as Record<string, string>) || {}) };

  if (!skipAuth) {
    Object.assign(headers, await getAuthHeader());
  }

  try {
    const res = await axiosInstance.request({ url: path, ...axiosOpts, headers });
    return res.data;
  } catch (err: any) {
    if (
      err.response?.status === 401 &&
      !skipAuth &&
      !_retry
    ) {
      await refreshSession();
      return apiRequest(path, { ...options, _retry: true });
    }

    if (err.response) {
      const status = err.response.status;
      const text = err.response.data
        ? JSON.stringify(err.response.data)
        : err.response.statusText;
      throw new Error(`API error ${status}: ${text}`);
    }

    throw err;
  }
}

export async function apiGet(path: string, options: ApiOptions = {}) {
  return apiRequest(path, { method: 'get', ...options });
}

export async function apiPost(path: string, data?: any, options: ApiOptions = {}) {
  return apiRequest(path, { method: 'post', data, ...options });
}

export async function apiPatch(path: string, data?: any, options: ApiOptions = {}) {
  return apiRequest(path, { method: 'patch', data, ...options });
}

export async function apiPut(path: string, data?: any, options: ApiOptions = {}) {
  return apiRequest(path, { method: 'put', data, ...options });
}

export async function apiDelete(path: string, options: ApiOptions = {}) {
  return apiRequest(path, { method: 'delete', ...options });
}

export const api = {
  request: apiRequest,
  fetch: apiRequest,
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  put: apiPut,
  delete: apiDelete,
  baseUrl: API_BASE_URL,
};

export default api;
