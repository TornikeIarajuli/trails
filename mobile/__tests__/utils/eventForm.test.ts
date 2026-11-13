import { validateEventForm } from '../../utils/eventForm';

const now = new Date('2026-11-13T10:00:00Z');
const tomorrow = new Date('2026-11-14T08:00:00Z');

const input = (overrides: Partial<Parameters<typeof validateEventForm>[0]> = {}) => ({
  title: 'Sunrise at Gergeti',
  description: '',
  scheduledAt: tomorrow,
  maxParticipants: '',
  ...overrides,
});

describe('validateEventForm', () => {
  it('accepts a valid event and trims its fields', () => {
    expect(validateEventForm(input({ title: '  Sunrise  ', description: '  Bring water ', maxParticipants: '8' }), now)).toEqual({
      ok: true,
      data: {
        title: 'Sunrise',
        description: 'Bring water',
        scheduled_at: tomorrow.toISOString(),
        max_participants: 8,
      },
    });
  });

  it('leaves out an empty description and an empty group size', () => {
    const result = validateEventForm(input(), now);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.data.description).toBeUndefined();
      expect(result.data.max_participants).toBeUndefined();
    }
  });

  it('requires a title of at most 200 characters', () => {
    expect(validateEventForm(input({ title: '   ' }), now)).toMatchObject({ ok: false, title: 'Title required' });
    expect(validateEventForm(input({ title: 'x'.repeat(201) }), now)).toMatchObject({ ok: false, title: 'Title too long' });
    expect(validateEventForm(input({ title: 'x'.repeat(200) }), now)).toMatchObject({ ok: true });
  });

  it('requires a date in the future', () => {
    expect(validateEventForm(input({ scheduledAt: new Date('2026-11-13T09:59:00Z') }), now)).toMatchObject({ ok: false, title: 'Invalid date' });
    expect(validateEventForm(input({ scheduledAt: new Date('invalid') }), now)).toMatchObject({ ok: false });
  });

  it('requires at least 2 participants when a limit is set', () => {
    expect(validateEventForm(input({ maxParticipants: '1' }), now)).toMatchObject({ ok: false, title: 'Invalid group size' });
    expect(validateEventForm(input({ maxParticipants: '0' }), now)).toMatchObject({ ok: false });
    expect(validateEventForm(input({ maxParticipants: '2.5' }), now)).toMatchObject({ ok: false });
    expect(validateEventForm(input({ maxParticipants: 'ten' }), now)).toMatchObject({ ok: false });
    expect(validateEventForm(input({ maxParticipants: '2' }), now)).toMatchObject({ ok: true });
  });
});
