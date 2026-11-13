export const EVENT_TITLE_MAX = 200;
export const EVENT_DESCRIPTION_MAX = 2000;
export const EVENT_MIN_PARTICIPANTS = 2;

export interface EventFormInput {
  title: string;
  description: string;
  scheduledAt: Date;
  /** Raw text of the optional "max participants" field. */
  maxParticipants: string;
}

export type EventFormResult =
  | {
      ok: true;
      data: {
        title: string;
        description?: string;
        scheduled_at: string;
        max_participants?: number;
      };
    }
  | { ok: false; title: string; message: string };

/**
 * Checks a new group hike against the same rules the API enforces, so the user
 * gets a specific message instead of a rejected request.
 */
export function validateEventForm(input: EventFormInput, now: Date = new Date()): EventFormResult {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, title: 'Title required', message: 'Please enter a title.' };
  }
  if (title.length > EVENT_TITLE_MAX) {
    return {
      ok: false,
      title: 'Title too long',
      message: `Please keep the title under ${EVENT_TITLE_MAX} characters.`,
    };
  }

  const description = input.description.trim();
  if (description.length > EVENT_DESCRIPTION_MAX) {
    return {
      ok: false,
      title: 'Description too long',
      message: `Please keep the description under ${EVENT_DESCRIPTION_MAX} characters.`,
    };
  }

  if (Number.isNaN(input.scheduledAt.getTime()) || input.scheduledAt.getTime() <= now.getTime()) {
    return { ok: false, title: 'Invalid date', message: 'Please choose a future date and time.' };
  }

  let maxParticipants: number | undefined;
  const rawMax = input.maxParticipants.trim();
  if (rawMax !== '') {
    if (!/^\d+$/.test(rawMax) || Number(rawMax) < EVENT_MIN_PARTICIPANTS) {
      return {
        ok: false,
        title: 'Invalid group size',
        message: `Max participants must be a whole number of at least ${EVENT_MIN_PARTICIPANTS} (it includes you). Leave it empty for no limit.`,
      };
    }
    maxParticipants = Number(rawMax);
  }

  return {
    ok: true,
    data: {
      title,
      description: description || undefined,
      scheduled_at: input.scheduledAt.toISOString(),
      max_participants: maxParticipants,
    },
  };
}
