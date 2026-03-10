import { useUserStore } from '../store/userStore';

const MOCK_DELAY_MS = 140;

export async function withDelay<T>(value: T, delayMs = MOCK_DELAY_MS): Promise<T> {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

  return value;
}

export function requireAppUserId(): string {
  const appUserId = useUserStore.getState().appUserId;
  if (!appUserId) {
    throw new Error('Authentication required.');
  }

  return appUserId;
}
