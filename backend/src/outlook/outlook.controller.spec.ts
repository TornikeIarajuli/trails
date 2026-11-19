import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  InternalOutlookController,
  OutlookController,
} from './outlook.controller';
import { OutlookService } from './outlook.service';

const TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Outlook controllers', () => {
  let app: INestApplication<App>;
  const outlookService = {
    cronToken: jest.fn(),
    run: jest.fn(),
    list: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OutlookController, InternalOutlookController],
      providers: [{ provide: OutlookService, useValue: outlookService }],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same pipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    outlookService.cronToken.mockResolvedValue(TOKEN);
    outlookService.run.mockResolvedValue({ trails: 0 });
    outlookService.list.mockResolvedValue({ data: [] });
  });

  describe('POST /internal/outlook/run', () => {
    const post = (token?: string, body: object = {}) => {
      const req = request(app.getHttpServer()).post('/internal/outlook/run');
      return (token === undefined ? req : req.set('x-cron-token', token)).send(
        body,
      );
    };

    it('starts the run in the background and answers 202 at once', async () => {
      let finish: (value: unknown) => void = () => undefined;
      outlookService.run.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );

      const res = await post(TOKEN).expect(202);

      expect(res.body).toEqual({ started: true });
      expect(outlookService.run).toHaveBeenCalledWith({ force: false });
      finish({ trails: 0 });
    });

    it('passes force on', async () => {
      await post(TOKEN, { force: true }).expect(202);
      expect(outlookService.run).toHaveBeenCalledWith({ force: true });
    });

    it('answers 401 without the token', async () => {
      await post().expect(401);
      expect(outlookService.cronToken).not.toHaveBeenCalled();
      expect(outlookService.run).not.toHaveBeenCalled();
    });

    it('answers 401 for a wrong token', async () => {
      await post('not-the-token').expect(401);
      await post(`${TOKEN}0`).expect(401);
      expect(outlookService.run).not.toHaveBeenCalled();
    });

    it('does nothing before migration 069', async () => {
      outlookService.cronToken.mockResolvedValue(null);

      const res = await post(TOKEN).expect(202);

      expect(res.body).toEqual({ started: false });
      expect(outlookService.run).not.toHaveBeenCalled();
    });

    it('rejects an unknown field', async () => {
      await post(TOKEN, { everything: true }).expect(400);
      expect(outlookService.run).not.toHaveBeenCalled();
    });
  });

  describe('GET /outlook', () => {
    it('lists the next three days, 30 trails at most, by default', async () => {
      outlookService.list.mockResolvedValue({ data: [{ trail_id: 't1' }] });

      const res = await request(app.getHttpServer())
        .get('/outlook')
        .expect(200);

      expect(res.body).toEqual({ data: [{ trail_id: 't1' }] });
      expect(outlookService.list).toHaveBeenCalledWith(3, 30);
    });

    it('takes the days and the limit asked for', async () => {
      await request(app.getHttpServer())
        .get('/outlook?days=7&limit=100')
        .expect(200);
      expect(outlookService.list).toHaveBeenCalledWith(7, 100);
    });

    it.each(['days=0', 'days=8', 'limit=0', 'limit=101', 'days=two'])(
      'answers 400 for %s',
      async (query) => {
        await request(app.getHttpServer()).get(`/outlook?${query}`).expect(400);
        expect(outlookService.list).not.toHaveBeenCalled();
      },
    );
  });
});
