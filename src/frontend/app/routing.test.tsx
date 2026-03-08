import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();
const useAuthStoreMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('tamagui', () => ({
  YStack: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Text: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Button: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/lib/store/authStore', () => ({
  useAuthStore: () => useAuthStoreMock(),
}));

vi.mock('../src/lib/auth', () => ({
  authProviders: [
    { key: 'google', label: 'Google' },
    { key: 'apple', label: 'Apple' },
    { key: 'facebook', label: 'Facebook' },
  ],
  signInWithProvider: vi.fn(),
}));

import IndexRoute from './index';
import LoginScreen from './login';

describe('auth routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes unauthenticated users to /login after initialization', async () => {
    useAuthStoreMock.mockReturnValue({ session: null, isInitializing: false });

    await act(async () => {
      create(<IndexRoute />);
    });

    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('routes authenticated users to /home after initialization', async () => {
    useAuthStoreMock.mockReturnValue({ session: { user: { id: 'u1' } }, isInitializing: false });

    await act(async () => {
      create(<IndexRoute />);
    });

    expect(replaceMock).toHaveBeenCalledWith('/home');
  });

  it('does not route while initialization is in progress', async () => {
    useAuthStoreMock.mockReturnValue({ session: null, isInitializing: true });

    await act(async () => {
      create(<IndexRoute />);
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('login screen redirects authenticated users to /home', async () => {
    useAuthStoreMock.mockReturnValue({ session: { user: { id: 'u1' } }, isInitializing: false });

    await act(async () => {
      create(<LoginScreen />);
    });

    expect(replaceMock).toHaveBeenCalledWith('/home');
  });
});
