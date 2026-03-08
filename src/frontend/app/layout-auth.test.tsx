import { describe, expect, it, vi } from 'vitest';

const userSetStateMock = vi.fn();
const setSessionMock = vi.fn();
const setInitializingMock = vi.fn();

vi.mock('expo-router', () => ({
  Slot: () => null,
}));

vi.mock('../src/theme', () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock('../src/lib/supacase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/store/userStore', () => ({
  useUserStore: {
    setState: (...args: unknown[]) => userSetStateMock(...args),
  },
}));

vi.mock('../src/lib/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      setSession: setSessionMock,
      setInitializing: setInitializingMock,
    }),
  },
}));

import { applyAuthSession } from './_layout';

describe('applyAuthSession', () => {
  it('hydrates store state for authenticated and signed-out sessions', () => {
    applyAuthSession({ user: { id: 'user-1' } } as never);
    expect(userSetStateMock).toHaveBeenCalledWith({ UserId: 'user-1' });
    expect(setSessionMock).toHaveBeenCalledWith({ user: { id: 'user-1' } });
    expect(setInitializingMock).toHaveBeenCalledWith(false);

    applyAuthSession(null);
    expect(userSetStateMock).toHaveBeenCalledWith({ UserId: null });
    expect(setSessionMock).toHaveBeenCalledWith(null);
  });
});
