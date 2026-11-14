import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CheckinsService } from './checkins.service';
import { AuthGuard } from '../common/guards/auth.guard';

const progress = {
  regions: [],
  totals: {
    regions_total: 0,
    regions_started: 0,
    regions_completed: 0,
    trails_total: 0,
    trails_completed: 0,
  },
};

describe('UsersController regions routes', () => {
  let app: INestApplication<App>;
  const usersService = { getRegionProgress: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: CheckinsService, useValue: {} },
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
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    usersService.getRegionProgress.mockReset();
    usersService.getRegionProgress.mockResolvedValue(progress);
  });

  it('serves the signed-in user at /users/me/regions', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/regions')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(res.body).toEqual(progress);
    expect(usersService.getRegionProgress).toHaveBeenCalledWith('me-id');
  });

  it('requires sign-in for /users/me/regions', async () => {
    await request(app.getHttpServer()).get('/users/me/regions').expect(401);
    expect(usersService.getRegionProgress).not.toHaveBeenCalled();
  });

  it('serves any user publicly at /users/:id/regions', async () => {
    const id = 'a0000000-0000-0000-0000-000000000001';

    await request(app.getHttpServer()).get(`/users/${id}/regions`).expect(200);

    expect(usersService.getRegionProgress).toHaveBeenCalledWith(id);
  });

  it('rejects an id that is not a UUID', async () => {
    await request(app.getHttpServer())
      .get('/users/not-a-uuid/regions')
      .expect(400);
    expect(usersService.getRegionProgress).not.toHaveBeenCalled();
  });
});
