import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OutlookService } from './outlook.service';
import { OutlookQueryDto, RunOutlookDto } from './dto/outlook.dto';
import { safeEqual } from '../common/internal-key';

@Controller('outlook')
export class OutlookController {
  constructor(private outlookService: OutlookService) {}

  /** The good hiking days ahead: per trail its first "go" day, today to `days - 1` days out. */
  @Get()
  list(@Query() query: OutlookQueryDto) {
    return this.outlookService.list(query.days ?? 3, query.limit ?? 30);
  }
}

/** Called by pg_cron once a day (migration 069), with the token stored next to the job. */
@Controller('internal/outlook')
export class InternalOutlookController {
  constructor(private outlookService: OutlookService) {}

  /** Starts the daily run and answers at once; the run carries on in the background. */
  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async run(
    @Headers('x-cron-token') token: string | undefined,
    @Body() dto: RunOutlookDto,
  ) {
    if (!token) throw new UnauthorizedException();
    const expected = await this.outlookService.cronToken();
    // Not set up yet (migration 069): there is nothing to run
    if (expected === null) return { started: false };
    if (!safeEqual(token, expected)) throw new UnauthorizedException();

    void this.outlookService.run({ force: dto.force === true });
    return { started: true };
  }
}
