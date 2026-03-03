import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Trails (e2e)', () => {
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

  describe('GET /api/trails', () => {
    it('returns 200 with data + pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/trails')
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts difficulty filter', () =>
      request(app.getHttpServer())
        .get('/api/trails?difficulty=hard')
        .expect(200));

    it('accepts region filter', () =>
      request(app.getHttpServer())
        .get('/api/trails?region=Kazbegi')
        .expect(200));

    it('accepts search query', () =>
      request(app.getHttpServer())
        .get('/api/trails?search=mountain')
        .expect(200));

    it('accepts distance range filters', () =>
      request(app.getHttpServer())
        .get('/api/trails?min_distance=5&max_distance=20')
        .expect(200));

    it('accepts pagination params', () =>
      request(app.getHttpServer())
        .get('/api/trails?page=1&limit=5')
        .expect(200));
  });

  describe('GET /api/trails/:id', () => {
    it('returns 400 for invalid UUID', () =>
      request(app.getHttpServer()).get('/api/trails/not-a-uuid').expect(400));

    it('returns 404 for non-existent trail', () =>
      request(app.getHttpServer())
        .get('/api/trails/00000000-0000-0000-0000-000000000000')
        .expect(404));
  });

  describe('GET /api/trails/nearby', () => {
    it('returns results near Tbilisi', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/trails/nearby?lat=41.69&lng=44.83&radius_km=50')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
