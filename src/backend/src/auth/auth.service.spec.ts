import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const originalFetch = global.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalAnonKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = originalAnonKey;
    }
  });

  it('maps Supabase login responses to the frontend token shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            expires_in: 3600,
            token_type: 'bearer',
          }),
        ),
    }) as never;

    const service = new AuthService();
    const result = await service.signIn({
      email: 'user@example.com',
      password: 'secret',
    });

    expect(result).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresIn: 3600,
      tokenType: 'bearer',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/token?grant_type=password',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('exchanges google id token and nonce through Supabase and maps response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            access_token: 'access-google',
            refresh_token: 'refresh-google',
            expires_in: 3600,
            token_type: 'bearer',
          }),
        ),
    }) as never;

    const service = new AuthService();
    const result = await service.signInWithGoogle({
      idToken: 'google-id-token',
      nonce: 'raw-google-nonce',
    });

    expect(result).toEqual({
      accessToken: 'access-google',
      refreshToken: 'refresh-google',
      expiresIn: 3600,
      tokenType: 'bearer',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/token?grant_type=id_token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          provider: 'google',
          id_token: 'google-id-token',
          nonce: 'raw-google-nonce',
        }),
      }),
    );
  });

  it('rejects google sign-in when id token is missing', async () => {
    global.fetch = jest.fn() as never;
    const service = new AuthService();

    await expect(service.signInWithGoogle({ idToken: '' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
