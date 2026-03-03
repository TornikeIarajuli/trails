import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Completions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/completions/me (auth required)', () => {
    it('returns 401 without auth header', () =>
      request(app.getHttpServer()).get('/api/completions/me').expect(401));
  });

  describe('POST /api/completions (auth required)', () => {
    it('returns 401 without auth header', () =>
      request(app.getHttpServer())
        .post('/api/completions')
        .send({
          trail_id: '00000000-0000-0000-0000-000000000000',
          proof_photo_url: 'https://example.com/photo.jpg',
          photo_lat: 41.7,
          photo_lng: 44.8,
        })
        .expect(401));
  });

  describe('POST /api/completions/record (auth required)', () => {
    it('returns 401 without auth header', () =>
      request(app.getHttpServer())
        .post('/api/completions/record')
        .send({ trail_id: '00000000-0000-0000-0000-000000000000' })
        .expect(401));
  });

  describe('GET /api/completions/trail/:trailId (public)', () => {
    it('returns 400 for invalid UUID', () =>
      request(app.getHttpServer())
        .get('/api/completions/trail/not-a-uuid')
        .expect(400));

    it('returns array for valid UUID (may be empty)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/completions/trail/00000000-0000-0000-0000-000000000000')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/completions/active/:trailId/count (public)', () => {
    it('returns count object for valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/completions/active/00000000-0000-0000-0000-000000000000/count',
        )
        .expect(200);
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });

  describe('PATCH /api/completions/:id/review (admin required)', () => {
    it('returns 401 without auth', () =>
      request(app.getHttpServer())
        .patch('/api/completions/00000000-0000-0000-0000-000000000000/review')
        .send({ status: 'approved' })
        .expect(401));
  });
});
