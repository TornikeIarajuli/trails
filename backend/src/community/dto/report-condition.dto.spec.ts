import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportConditionDto } from './report-condition.dto';

const TRAIL_ID = 'a0000000-0000-0000-0000-000000000001';

const errorsFor = async (plain: object) =>
  (await validate(plainToInstance(ReportConditionDto, plain))).map(
    (e) => e.property,
  );

describe('ReportConditionDto', () => {
  it.each([
    'trail_clear',
    'muddy',
    'snow',
    'fallen_tree',
    'flooded',
    'overgrown',
    'damaged',
    'closed',
    'crowded',
    'water_dry',
  ])('accepts the condition %p', async (condition_type) => {
    expect(
      await errorsFor({ trail_id: TRAIL_ID, condition_type, severity: 'info' }),
    ).toEqual([]);
  });

  it('rejects an unknown condition or severity', async () => {
    expect(
      await errorsFor({
        trail_id: TRAIL_ID,
        condition_type: 'sunny',
        severity: 'extreme',
      }),
    ).toEqual(['condition_type', 'severity']);
  });
});
