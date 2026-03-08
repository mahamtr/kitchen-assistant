import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('tamagui', () => ({
  YStack: () => null,
  Button: () => null,
  Text: () => null,
}));

vi.mock('../src/lib/supacase', () => ({
  default: { auth: { getSession: vi.fn(), signOut: vi.fn() } },
}));

vi.mock('../src/lib/api', () => ({
  default: { fetch: vi.fn() },
}));

vi.mock('../src/theme', () => ({
  useThemeContext: () => ({ themeName: 'light', toggleTheme: vi.fn() }),
}));

import { signOutAndRoute } from './home';

describe('signOutAndRoute', () => {
  it('routes to /login when sign out succeeds', async () => {
    const replaceMock = vi.fn();
    const message = await signOutAndRoute(async () => ({ error: null }), replaceMock);

    expect(message).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('returns sign out error message and does not route when sign out fails', async () => {
    const replaceMock = vi.fn();
    const message = await signOutAndRoute(
      async () => ({ error: { message: 'Network down' } }),
      replaceMock,
    );

    expect(message).toBe('Network down');
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
