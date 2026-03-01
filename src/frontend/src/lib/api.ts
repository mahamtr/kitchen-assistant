import { Platform } from 'react-native';
import axios, { AxiosRequestConfig } from 'axios';
import supabase from './supacase';

const isWeb = Platform.OS === 'web';
const DEFAULT_LOCAL = 'http://localhost:3000';
const DEFAULT_DOCKER = 'http://backend:3000';
export const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? (isWeb ? DEFAULT_LOCAL : DEFAULT_DOCKER);

type ApiOptions = AxiosRequestConfig & { skipAuth?: boolean };

async function getAuthHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const axiosInstance = axios.create({ baseURL: BASE_URL, headers: { 'Content-Type': 'application/json' } });

export async function apiRequest(path: string, options: ApiOptions = {}) {
    const { skipAuth, ...axiosOpts } = options;
    const headers = { ...(axiosOpts.headers as Record<string, string> || {}) };
    if (!skipAuth) Object.assign(headers, await getAuthHeader());

    try {
        const res = await axiosInstance.request({ url: path, ...axiosOpts, headers });
        return res.data;
    } catch (err: any) {
        if (err.response) {
            const status = err.response.status;
            const text = err.response.data ? JSON.stringify(err.response.data) : err.response.statusText;
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

export const api = { request: apiRequest, fetch: apiRequest, get: apiGet, post: apiPost, baseUrl: BASE_URL };

export default api;
