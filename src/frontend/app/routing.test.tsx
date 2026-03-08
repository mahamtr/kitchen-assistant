import { describe, expect, it } from 'vitest';
import { getIndexRedirectRoute, shouldRedirectLoginToHome } from '../src/lib/authRouting';

describe('auth routing helpers', () => {
  it('routes unauthenticated users to /login after initialization', () => {
    expect(getIndexRedirectRoute(false, null)).toBe('/login');
  });

  it('routes authenticated users to /home after initialization', () => {
    expect(getIndexRedirectRoute(false, { user: { id: 'u1' } } as never)).toBe('/home');
  });

  it('does not route while initialization is in progress', () => {
    expect(getIndexRedirectRoute(true, null)).toBeNull();
  });

  it('login screen redirects authenticated users to /home', () => {
    expect(shouldRedirectLoginToHome({ user: { id: 'u1' } } as never)).toBe(true);
  });
});
