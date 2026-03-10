import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;
  const originalProjectRef = process.env.SUPABASE_PROJECT_REF;

  beforeEach(async () => {
    process.env.SUPABASE_PROJECT_REF = 'kitchen-assistant-test';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    if (originalProjectRef === undefined) {
      delete process.env.SUPABASE_PROJECT_REF;
      return;
    }

    process.env.SUPABASE_PROJECT_REF = originalProjectRef;
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });
});
