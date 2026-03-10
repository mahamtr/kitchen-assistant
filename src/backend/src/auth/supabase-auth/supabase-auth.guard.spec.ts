import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseJwtService } from '../supabase-jwt/supabase-jwt.service';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

type MockRequest = {
  headers: {
    authorization?: string;
  };
  user?: {
    sub: string;
  };
};

function createContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T = MockRequest>() => request as T,
    }),
  } as unknown as ExecutionContext;
}

function createJwtService(
  verify: SupabaseJwtService['verify'],
): SupabaseJwtService {
  const jwtService = Object.create(
    SupabaseJwtService.prototype,
  ) as SupabaseJwtService;
  jwtService.verify = verify;
  return jwtService;
}

describe('SupabaseAuthGuard', () => {
  it('attaches the verified user to the request', async () => {
    const verify: SupabaseJwtService['verify'] = jest
      .fn()
      .mockResolvedValue({ sub: 'user-1' });
    const guard = new SupabaseAuthGuard(createJwtService(verify));
    const request: MockRequest = {
      headers: {
        authorization: 'Bearer token-123',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('token-123');
    expect(request.user).toEqual({ sub: 'user-1' });
  });

  it('rejects requests without a bearer token', async () => {
    const verify: SupabaseJwtService['verify'] = jest.fn();
    const guard = new SupabaseAuthGuard(createJwtService(verify));

    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
