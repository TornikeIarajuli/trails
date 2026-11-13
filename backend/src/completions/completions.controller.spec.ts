import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CompletionsController } from './completions.controller';
import { CompletionsService } from './completions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { currentYearInTbilisi } from './dto/mark-past-hike.dto';

const TRAIL_ID = 'a0000000-0000-0000-0000-000000000001';

const completion = (alreadyExisted: boolean) => ({
  id: 'comp-p',
  user_id: 'me-id',
  trail_id: TRAIL_ID,
  status: 'approved',
  source: 'past',
  completed_at: '2019-01-01T12:00:00.000Z',
  new_badge_ids: [],
  already_existed: alreadyExisted,
});

describe('CompletionsController POST /completions/past', () => {
  let app: INestApplication<App>;
  const completionsService = { markPastHike: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CompletionsController],
      providers: [
        { provide: CompletionsService, useValue: completionsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user?: { id: string };
          }>();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.user = { id: 'me-id' };
          return true;
        },
      })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => false })
      .compile();

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

  beforeEach(() => completionsService.markPastHike.mockReset());

  const post = (body: object, auth = true) => {
    const req = request(app.getHttpServer()).post('/completions/past');
    return (auth ? req.set('Authorization', 'Bearer token') : req).send(body);
  };

  it('answers 201 when the trail is marked now', async () => {
    completionsService.markPastHike.mockResolvedValue(completion(false));

    const res = await post({ trail_id: TRAIL_ID, year: 2019 }).expect(201);

    expect(res.body).toEqual(completion(false));
    expect(completionsService.markPastHike).toHaveBeenCalledWith('me-id', {
      trail_id: TRAIL_ID,
      year: 2019,
    });
  });

  it('answers 200 when the trail was already done', async () => {
    completionsService.markPastHike.mockResolvedValue(completion(true));

    const res = await post({ trail_id: TRAIL_ID, year: 2019 }).expect(200);

    expect(res.body.already_existed).toBe(true);
  });

  it('passes the 409 for a completion waiting for review through', async () => {
    completionsService.markPastHike.mockRejectedValue(
      new ConflictException('Your hike on this trail is waiting for review.'),
    );

    const res = await post({ trail_id: TRAIL_ID, year: 2019 }).expect(409);

    expect(res.body.message).toBe(
      'Your hike on this trail is waiting for review.',
    );
  });

  it.each([
    ['a year before 1950', { trail_id: TRAIL_ID, year: 1949 }],
    [
      'a year in the future',
      { trail_id: TRAIL_ID, year: currentYearInTbilisi() + 1 },
    ],
    ['a fractional year', { trail_id: TRAIL_ID, year: 2019.5 }],
    ['no year', { trail_id: TRAIL_ID }],
    ['a bad trail id', { trail_id: 'nope', year: 2019 }],
    ['an unknown field', { trail_id: TRAIL_ID, year: 2019, source: 'hike' }],
  ])('answers 400 for %s', async (_label, body) => {
    await post(body).expect(400);
    expect(completionsService.markPastHike).not.toHaveBeenCalled();
  });

  it('requires sign-in', async () => {
    await post({ trail_id: TRAIL_ID, year: 2019 }, false).expect(401);
    expect(completionsService.markPastHike).not.toHaveBeenCalled();
  });
});
