import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getDisplayName, type AuthenticatedUser } from '../common/current-user';

type SupabaseSessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user?: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null;
};

@Injectable()
export class AuthService {
  private get supabaseUrl() {
    const explicitUrl = process.env.SUPABASE_URL?.trim();
    if (explicitUrl) {
      return explicitUrl.replace(/\/$/, '');
    }

    const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
    if (projectRef) {
      return `https://${projectRef}.supabase.co`;
    }

    throw new InternalServerErrorException(
      'Missing Supabase URL configuration',
    );
  }

  private get supabaseAnonKey() {
    const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

    if (!anonKey) {
      throw new InternalServerErrorException('Missing SUPABASE_ANON_KEY');
    }

    return anonKey;
  }

  async signUp(payload: { fullName: string; email: string; password: string }) {
    const data = await this.supabaseRequest('/auth/v1/signup', {
      method: 'POST',
      body: {
        email: payload.email,
        password: payload.password,
        data: {
          fullName: payload.fullName,
          displayName: payload.fullName,
        },
      },
    });

    return {
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email ?? null,
            displayName:
              (typeof data.user.user_metadata?.displayName === 'string' &&
                data.user.user_metadata.displayName) ||
              (typeof data.user.user_metadata?.fullName === 'string' &&
                data.user.user_metadata.fullName) ||
              data.user.email?.split('@')[0] ||
              payload.fullName,
          }
        : null,
      session: data.access_token ? this.toTokenResponse(data) : null,
      requiresEmailVerification: !data.access_token,
    };
  }

  async signIn(payload: { email: string; password: string }) {
    const data = await this.supabaseRequest(
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        body: {
          email: payload.email,
          password: payload.password,
        },
      },
    );

    return this.toTokenResponse(data);
  }

  async refresh(refreshToken: string) {
    const data = await this.supabaseRequest(
      '/auth/v1/token?grant_type=refresh_token',
      {
        method: 'POST',
        body: {
          refresh_token: refreshToken,
        },
      },
    );

    return this.toTokenResponse(data);
  }

  async forgotPassword(email: string) {
    await this.supabaseRequest('/auth/v1/recover', {
      method: 'POST',
      body: { email },
    });

    return {
      message: 'If the account exists, reset instructions were sent.',
    };
  }

  async resetPassword(
    request: Request,
    payload: {
      newPassword: string;
      confirmPassword: string;
      resetToken?: string;
    },
  ) {
    if (payload.newPassword !== payload.confirmPassword) {
      throw new UnauthorizedException('Passwords do not match.');
    }

    const token = this.extractBearerToken(request) ?? payload.resetToken;

    if (!token) {
      throw new UnauthorizedException(
        'Reset password requires a recovery session token.',
      );
    }

    await this.supabaseRequest('/auth/v1/user', {
      method: 'PUT',
      body: { password: payload.newPassword },
      accessToken: token,
    });

    return {
      message: 'Password updated successfully.',
    };
  }

  async logout(request: Request) {
    const accessToken = this.extractBearerToken(request);

    if (accessToken) {
      await this.supabaseRequest('/auth/v1/logout', {
        method: 'POST',
        accessToken,
      });
    }

    return { success: true };
  }

  getSessionUser(user: AuthenticatedUser) {
    return {
      supabaseUserId: user.sub,
      email: user.email ?? null,
      displayName: getDisplayName(user),
    };
  }

  async signInWithGoogle(payload: { idToken: string; nonce?: string }) {
    const idToken = payload.idToken?.trim();
    const nonce = payload.nonce?.trim();

    if (!idToken) {
      throw new UnauthorizedException('Google idToken is required.');
    }

    const data = await this.supabaseRequest('/auth/v1/token?grant_type=id_token', {
      method: 'POST',
      body: {
        provider: 'google',
        id_token: idToken,
        ...(nonce ? { nonce } : {}),
      },
    });

    return this.toTokenResponse(data);
  }

  private toTokenResponse(data: SupabaseSessionResponse) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  private extractBearerToken(request: Request) {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.replace('Bearer ', '').trim();
  }

  private async supabaseRequest(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PUT';
      body?: Record<string, unknown>;
      accessToken?: string;
    },
  ) {
    const response = await fetch(`${this.supabaseUrl}${path}`, {
      method: options.method,
      headers: {
        apikey: this.supabaseAnonKey,
        'Content-Type': 'application/json',
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        msg?: string;
        message?: string;
        error_description?: string;
      } | null;

      throw new UnauthorizedException(
        payload?.msg ??
          payload?.message ??
          payload?.error_description ??
          'Supabase auth request failed.',
      );
    }

    const text = await response.text();
    return text
      ? (JSON.parse(text) as SupabaseSessionResponse)
      : ({} as SupabaseSessionResponse);
  }
}
