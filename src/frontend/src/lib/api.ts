import { Platform } from 'react-native';
import supabase from './supacase';

const isWeb = Platform.OS === 'web';
const DEFAULT_LOCAL = 'http://localhost:3000';
const DEFAULT_DOCKER = 'http://backend:3000';
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? (isWeb ? DEFAULT_LOCAL : DEFAULT_DOCKER);

type FetchOptions = RequestInit & { skipAuth?: boolean };

async function getAuthHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path: string, options: FetchOptions = {}) {
    const cleanBase = BASE_URL.replace(/\/$/, '');
    const url = path.startsWith('http') ? path : `${cleanBase}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };

    if (!options.skipAuth) {
        Object.assign(headers, await getAuthHeader());
    }

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

export const api = { fetch: apiFetch, baseUrl: BASE_URL };

export default api;
