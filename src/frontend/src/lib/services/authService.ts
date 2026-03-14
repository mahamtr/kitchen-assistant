import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
  type StoredAuthSession,
} from '../authSession';
import { apiGet, apiPost } from '../api';
import { useUserStore } from '../store/userStore';
import type {
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SessionUserSummary,
  SignInRequest,
  SignUpRequest,
} from '../types/contracts';
import { userService } from './userService';

type SignUpResponse = {
  user: SessionUserSummary | null;
  session: StoredAuthSession | null;
  requiresEmailVerification: boolean;
};

async function restoreSession(): Promise<SessionUserSummary | null> {
  const storedSession = await getStoredAuthSession();

  if (!storedSession?.accessToken) {
    useUserStore.getState().setUnauthenticated();
    return null;
  }

  try {
    const authUser = (await apiGet('/auth/session')) as SessionUserSummary;
    const profile = await userService.bootstrapFromSession(authUser);
    const preference = await userService.getPreferences();
    useUserStore
      .getState()
      .setAuthenticated(authUser, profile.id, Boolean(preference));
    return authUser;
  } catch (error) {
    await clearStoredAuthSession();
    useUserStore.getState().setUnauthenticated();
    throw error;
  }
}

async function signIn(payload: SignInRequest) {
  const session = (await apiPost('/auth/login', payload, {
    skipAuth: true,
  })) as StoredAuthSession;
  await setStoredAuthSession(session);
  await restoreSession();
  return session;
}

async function signUp(payload: SignUpRequest): Promise<SignUpResponse> {
  const result = (await apiPost('/auth/signup', payload, {
    skipAuth: true,
  })) as SignUpResponse;

  if (result.session) {
    await setStoredAuthSession(result.session);
    await restoreSession();
    return result;
  }

  await clearStoredAuthSession();
  useUserStore.getState().setUnauthenticated();
  return result;
}

async function signInWithGoogle() {
  throw new Error('Google sign-in is not available yet.');
}

async function requestPasswordReset(payload: ForgotPasswordRequest) {
  return apiPost('/auth/password/forgot', payload, { skipAuth: true });
}

async function updatePassword(payload: ResetPasswordRequest) {
  if (payload.newPassword !== payload.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  return apiPost('/auth/password/reset', payload, { skipAuth: true });
}

async function signOut() {
  try {
    await apiPost('/auth/logout');
  } catch {
    // Clear the local session even if the backend logout call fails.
  }

  await clearStoredAuthSession();
  useUserStore.getState().setUnauthenticated();
}

async function getSessionUser(): Promise<SessionUserSummary | null> {
  return restoreSession();
}

export const authService = {
  getSessionUser,
  requestPasswordReset,
  restoreSession,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  updatePassword,
};

export default authService;
