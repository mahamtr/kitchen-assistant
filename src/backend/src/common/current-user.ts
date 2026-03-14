import type { JWTPayload } from 'jose';

export type AuthenticatedUser = JWTPayload & {
  sub: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export function getDisplayName(user: AuthenticatedUser): string | null {
  const metadata = user.user_metadata;

  const displayName =
    (typeof metadata?.displayName === 'string' && metadata.displayName) ||
    (typeof metadata?.fullName === 'string' && metadata.fullName) ||
    (typeof metadata?.name === 'string' && metadata.name) ||
    user.email?.split('@')[0];

  return displayName ?? null;
}
