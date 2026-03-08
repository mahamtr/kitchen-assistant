import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const userSetStateMock = vi.fn();
const setSessionMock = vi.fn();
const setInitializingMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock('expo-router', () => ({
  Slot: () => null,
}));

vi.mock('../src/theme', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/lib/supacase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
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

import RootLayout from './_layout';

describe('RootLayout auth bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates initial session, subscribes to auth changes, and unsubscribes on unmount', async () => {
    getSessionMock.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1' } } },
    });
    onAuthStateChangeMock.mockImplementationOnce((handler: (event: string, session: unknown) => void) => {
      handler('SIGNED_IN', { user: { id: 'user-2' } });
      return {
        data: {
          subscription: {
            unsubscribe: unsubscribeMock,
          },
        },
      };
    });

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<RootLayout />);
      await Promise.resolve();
    });

    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(userSetStateMock).toHaveBeenCalledWith({ UserId: 'user-1' });
    expect(setSessionMock).toHaveBeenCalledWith({ user: { id: 'user-1' } });
    expect(setInitializingMock).toHaveBeenCalledWith(false);

    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
    expect(userSetStateMock).toHaveBeenCalledWith({ UserId: 'user-2' });
    expect(setSessionMock).toHaveBeenCalledWith({ user: { id: 'user-2' } });

    await act(async () => {
      tree!.unmount();
    });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
