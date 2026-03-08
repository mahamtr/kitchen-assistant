import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Provider } from '@supabase/supabase-js';
import supabase from './supacase';

WebBrowser.maybeCompleteAuthSession();

export const authProviders: { key: Provider; label: string }[] = [
  { key: 'google', label: 'Google' },
  { key: 'apple', label: 'Apple' },
  { key: 'facebook', label: 'Facebook' },
];

const getRedirectTo = () =>
  makeRedirectUri({
    scheme: 'kitchenassistant',
    path: 'auth/callback',
  });

export const signInWithProvider = async (provider: Provider) => {
  const redirectTo = getRedirectTo();

  if (Platform.OS === 'web') {
    return supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return { data, error };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success' && result.url) {
    const fragment = result.url.split('#')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      return { data, error: sessionError ?? null, resultType: result.type as const };
    }
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return {
      data,
      error: new Error('Sign-in cancelled.'),
      resultType: result.type as const,
    };
  }

  return {
    data,
    error: new Error('Unable to complete OAuth flow.'),
    resultType: result.type as const,
  };
};
