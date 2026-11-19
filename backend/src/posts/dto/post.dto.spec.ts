import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePostDto, UpdatePostDto } from './post.dto';

const STORAGE = 'https://proj.supabase.co/storage/v1/object/public/trail-media/posts/u/1.jpg';

async function check<T extends object>(cls: new () => T, plain: object) {
  const dto = plainToInstance(cls, plain);
  const errors = (await validate(dto)).map((e) => e.property);
  return { dto, errors };
}

describe('post DTOs', () => {
  const original = process.env.SUPABASE_URL;
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
  });
  afterAll(() => {
    process.env.SUPABASE_URL = original;
  });

  it('trims the text and the place, and treats an empty place as none', async () => {
    const { dto, errors } = await check(CreatePostDto, { body: '  Snow up high  ', place_name: '   ' });
    expect(errors).toEqual([]);
    expect(dto.body).toBe('Snow up high');
    expect(dto.place_name).toBeNull();
  });

  it('takes up to six photos uploaded through the API', async () => {
    expect((await check(CreatePostDto, { photo_urls: Array(6).fill(STORAGE) })).errors).toEqual([]);
    expect((await check(CreatePostDto, { photo_urls: Array(7).fill(STORAGE) })).errors).toEqual(['photo_urls']);
    expect((await check(CreatePostDto, { photo_urls: ['https://evil.example/x.jpg'] })).errors).toEqual(['photo_urls']);
  });

  it('limits the text to 2,000 characters and the place to 80', async () => {
    const { errors } = await check(CreatePostDto, { body: 'x'.repeat(2001), place_name: 'y'.repeat(81) });
    expect(errors.sort()).toEqual(['body', 'place_name']);
  });

  it('lets an edit clear the trail or the place with null', async () => {
    const { errors } = await check(UpdatePostDto, { trail_id: null, place_name: null });
    expect(errors).toEqual([]);
    expect((await check(UpdatePostDto, { trail_id: 'not-a-uuid' })).errors).toEqual(['trail_id']);
  });
});
