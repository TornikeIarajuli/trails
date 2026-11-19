import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateBookingDto,
  GuideProfileDto,
  UpdateBookingDto,
} from './guide.dto';

async function check<T extends object>(cls: new () => T, plain: object) {
  const dto = plainToInstance(cls, plain);
  return { dto, errors: (await validate(dto)).map((e) => e.property).sort() };
}

const profile = {
  headline: 'Mountain guide in Svaneti',
  bio: 'Ten years of guiding in Svaneti and Racha, first aid certified.',
  regions: ['Svaneti', 'Racha'],
  languages: ['Georgian', 'English'],
};

describe('GuideProfileDto', () => {
  it('takes a profile, a Telegram name with or without @, and a phone number', async () => {
    const { dto, errors } = await check(GuideProfileDto, {
      ...profile,
      contact_phone: ' +995 599 12-34-56 ',
      contact_telegram: '@nino_guide',
      price_gel: 250,
      price_note: '',
    });
    expect(errors).toEqual([]);
    expect(dto.contact_telegram).toBe('nino_guide');
    expect(dto.contact_phone).toBe('+995 599 12-34-56');
    expect(dto.price_note).toBeNull();
  });

  it('wants a real region, at least one language and a bio of some length', async () => {
    const { errors } = await check(GuideProfileDto, {
      ...profile,
      regions: ['Narnia'],
      languages: [],
      bio: 'Hi',
    });
    expect(errors).toEqual(['bio', 'languages', 'regions']);
  });

  it('refuses a phone or Telegram name that is not one', async () => {
    const { errors } = await check(GuideProfileDto, {
      ...profile,
      contact_phone: 'call me',
      contact_telegram: 'a b',
    });
    expect(errors).toEqual(['contact_phone', 'contact_telegram']);
  });
});

describe('booking DTOs', () => {
  it('takes a date, days, group size and a message', async () => {
    const ok = await check(CreateBookingDto, {
      guide_id: 'a0000000-0000-0000-0000-000000000001',
      start_date: '2026-12-12',
      days: '2',
      group_size: 3,
      message: '  Ushguli?  ',
    });
    expect(ok.errors).toEqual([]);
    expect(ok.dto.days).toBe(2);
    expect(ok.dto.message).toBe('Ushguli?');

    const bad = await check(CreateBookingDto, {
      guide_id: 'x',
      start_date: '12/12/2026',
      days: 0,
      group_size: 99,
      message: '',
    });
    expect(bad.errors).toEqual([
      'days',
      'group_size',
      'guide_id',
      'message',
      'start_date',
    ]);
  });

  it('answers with accepted, declined or cancelled only', async () => {
    expect(
      (await check(UpdateBookingDto, { status: 'accepted', reply: 'See you' }))
        .errors,
    ).toEqual([]);
    expect((await check(UpdateBookingDto, { status: 'maybe' })).errors).toEqual(
      ['status'],
    );
  });
});
