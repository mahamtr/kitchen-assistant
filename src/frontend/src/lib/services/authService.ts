import * as Linking from 'expo-linking';
import { supabase } from '../supacase';
import type {
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SessionUserSummary,
  SignInRequest,
  SignUpRequest,
} from '../types/contracts';

function toSessionUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): SessionUserSummary {
  return {
    supabaseUserId: user.id,
    email: user.email ?? null,
    displayName:
      (typeof user.user_metadata?.displayName === 'string' && user.user_metadata.displayName) ||
      (typeof user.user_metadata?.fullName === 'string' && user.user_metadata.fullName) ||
      (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
      user.email?.split('@')[0] ||
      'Kitchen Assistant User',
  };
}

async function signIn(payload: SignInRequest) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.session;
}

async function signUp(payload: SignUpRequest) {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        fullName: payload.fullName,
        displayName: payload.fullName,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    user: data.user ? toSessionUser(data.user) : null,
    session: data.session,
    requiresEmailVerification: !data.session,
  };
}

async function signInWithGoogle() {
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function requestPasswordReset(payload: ForgotPasswordRequest) {
  const redirectTo = Linking.createURL('/reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    message: 'If the account exists, reset instructions were sent.',
  };
}

async function updatePassword(payload: ResetPasswordRequest) {
  if (payload.newPassword !== payload.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  const { error } = await supabase.auth.updateUser({
    password: payload.newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    message: 'Password updated successfully.',
  };
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

async function getSessionUser(): Promise<SessionUserSummary | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return data.session?.user ? toSessionUser(data.session.user) : null;
}

export const authService = {
  getSessionUser,
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  updatePassword,
};

export default authService;
