import type { Session } from '@supabase/supabase-js';

export function getIndexRedirectRoute(
  isInitializing: boolean,
  session: Session | null,
): '/home' | '/login' | null {
  if (isInitializing) return null;
  return session ? '/home' : '/login';
}

export function shouldRedirectLoginToHome(session: Session | null): boolean {
  return Boolean(session);
}
