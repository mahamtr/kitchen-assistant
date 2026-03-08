import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOAuthMock = vi.fn();
const setSessionMock = vi.fn();
const openAuthSessionAsyncMock = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'kitchenassistant://auth/callback'),
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: (...args: unknown[]) => openAuthSessionAsyncMock(...args),
}));

vi.mock('./supacase', () => ({
  default: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
      setSession: (...args: unknown[]) => setSessionMock(...args),
    },
  },
}));

import { Platform } from 'react-native';
import { signInWithProvider } from './auth';

describe('signInWithProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses web OAuth flow with redirectTo and without skipBrowserRedirect', async () => {
    Platform.OS = 'web';
    signInWithOAuthMock.mockResolvedValueOnce({ data: { provider: 'google' }, error: null });

    await signInWithProvider('google');

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'kitchenassistant://auth/callback',
      },
    });
  });

  it('sets session from native successful auth callback tokens', async () => {
    Platform.OS = 'ios';
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { url: 'https://example.com/oauth' },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValueOnce({
      type: 'success',
      url: 'kitchenassistant://auth/callback#access_token=token-a&refresh_token=token-r',
    });
    setSessionMock.mockResolvedValueOnce({ error: null });

    const result = await signInWithProvider('apple');

    expect(openAuthSessionAsyncMock).toHaveBeenCalledWith(
      'https://example.com/oauth',
      'kitchenassistant://auth/callback',
    );
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: 'token-a',
      refresh_token: 'token-r',
    });
    expect(result.error).toBeNull();
  });

  it('returns cancellation error for cancelled native auth', async () => {
    Platform.OS = 'android';
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { url: 'https://example.com/oauth' },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValueOnce({ type: 'cancel' });

    const result = await signInWithProvider('facebook');

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Sign-in cancelled.');
  });

  it('returns fallback error when native callback has no tokens', async () => {
    Platform.OS = 'ios';
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { url: 'https://example.com/oauth' },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValueOnce({
      type: 'success',
      url: 'kitchenassistant://auth/callback#foo=bar',
    });

    const result = await signInWithProvider('google');

    expect(setSessionMock).not.toHaveBeenCalled();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Unable to complete OAuth flow.');
  });
});
