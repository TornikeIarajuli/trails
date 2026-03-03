import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Auth E2E tests — requires a running Supabase connection via env vars.
 * Use a dedicated test project or mock SupabaseService for CI.
 *
 * Run: npx jest --config test/jest-e2e.json test/auth.e2e-spec.ts
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'TestPass123';
  const testUsername = `user_${Date.now()}`.slice(0, 30);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/signup', () => {
    it('rejects invalid email', () =>
      request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: testPassword, username: testUsername })
        .expect(400));

    it('rejects weak password (no uppercase)', () =>
      request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: testEmail, password: 'alllowercase1', username: testUsername })
        .expect(400));

    it('rejects short username', () =>
      request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword, username: 'ab' })
        .expect(400));

    it('accepts valid signup payload structure', async () => {
      // This will fail at Supabase level in CI without real creds — that's expected.
      // The test verifies our DTO validation passes (400 = our validation; 5xx = Supabase).
      const res = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword, username: testUsername });

      // Either created (201) or a Supabase-level error — not a 400 validation error
      expect(res.status).not.toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects missing credentials', () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400));

    it('rejects invalid email format', () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bad', password: testPassword })
        .expect(400));
  });
});
