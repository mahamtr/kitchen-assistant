import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseJwtService } from './supabase-jwt.service';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

describe('SupabaseJwtService', () => {
  let service: SupabaseJwtService;
  const originalProjectRef = process.env.SUPABASE_PROJECT_REF;

  beforeEach(async () => {
    process.env.SUPABASE_PROJECT_REF = 'kitchen-assistant-test';
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupabaseJwtService],
    }).compile();

    service = module.get<SupabaseJwtService>(SupabaseJwtService);
  });

  afterEach(() => {
    if (originalProjectRef === undefined) {
      delete process.env.SUPABASE_PROJECT_REF;
      return;
    }

    process.env.SUPABASE_PROJECT_REF = originalProjectRef;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws if SUPABASE_PROJECT_REF is missing', () => {
    delete process.env.SUPABASE_PROJECT_REF;

    expect(() => new SupabaseJwtService()).toThrow(
      'Missing SUPABASE_PROJECT_REF',
    );
  });
});
