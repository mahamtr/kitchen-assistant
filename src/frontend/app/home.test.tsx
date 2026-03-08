import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();
const getSessionMock = vi.fn();
const signOutMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function YStackMock({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function TextMock({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ButtonMock({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock('tamagui', () => ({
  YStack: ({ children, ...props }: { children: React.ReactNode }) => (
    <YStackMock {...props}>{children}</YStackMock>
  ),
  Text: ({ children, ...props }: { children: React.ReactNode }) => <TextMock {...props}>{children}</TextMock>,
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <ButtonMock {...props}>{children}</ButtonMock>
  ),
}));

vi.mock('../src/lib/supacase', () => ({
  default: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}));

vi.mock('../src/lib/api', () => ({
  default: {
    fetch: (...args: unknown[]) => fetchMock(...args),
  },
}));

vi.mock('../src/theme', () => ({
  useThemeContext: () => ({ themeName: 'light', toggleTheme: vi.fn() }),
}));

import HomeScreen from './home';

describe('HomeScreen logout behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    fetchMock.mockResolvedValue({});
  });

  it('shows logout loading state while sign out is in progress', async () => {
    let resolveSignOut: (() => void) | undefined;
    signOutMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSignOut = () => resolve({ error: null });
        }),
    );

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<HomeScreen />);
      await Promise.resolve();
    });

    const logoutButton = tree!.root.findAllByType(ButtonMock)[0];

    await act(async () => {
      logoutButton.props.onPress();
      await Promise.resolve();
    });

    const labelsDuring = tree!.root.findAllByType(ButtonMock).map((node) => String(node.props.children));
    expect(labelsDuring).toContain('Logging out…');

    await act(async () => {
      resolveSignOut?.();
      await Promise.resolve();
    });

    const labelsAfter = tree!.root.findAllByType(ButtonMock).map((node) => String(node.props.children));
    expect(labelsAfter).toContain('Logout');
  });

  it('shows sign out error message and does not route when logout fails', async () => {
    signOutMock.mockResolvedValueOnce({ error: { message: 'Network down' } });

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<HomeScreen />);
      await Promise.resolve();
    });

    const logoutButton = tree!.root.findAllByType(ButtonMock)[0];

    await act(async () => {
      await logoutButton.props.onPress();
    });

    const renderedText = tree!.toJSON();
    expect(JSON.stringify(renderedText)).toContain('Network down');
    expect(replaceMock).not.toHaveBeenCalledWith('/login');
  });
});
