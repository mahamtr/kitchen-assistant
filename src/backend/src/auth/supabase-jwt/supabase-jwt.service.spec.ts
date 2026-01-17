import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseJwtService } from './supabase-jwt.service';

describe('SupabaseJwtService', () => {
  let service: SupabaseJwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupabaseJwtService],
    }).compile();

    service = module.get<SupabaseJwtService>(SupabaseJwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
