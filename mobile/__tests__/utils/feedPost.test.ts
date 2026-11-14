import {
  commentsLinkLabel,
  completionChips,
  conditionLabel,
  feedAction,
  feedMedia,
  formatElapsed,
  likesLabel,
  reviewStars,
  shareMessage,
} from '../../utils/feedPost';
import type { FeedItem } from '../../types/feed';

const item = (extra: Partial<FeedItem> = {}): FeedItem => ({
  activity_id: 'a1',
  activity_type: 'completion',
  user_id: 'u1',
  trail_id: 't1',
  created_at: '2026-11-14T08:00:00Z',
  extra_text: null,
  photo_url: null,
  photo_urls: null,
  user_username: 'nino',
  user_full_name: null,
  user_avatar_url: null,
  trail_name_en: 'Juta to Roshka',
  trail_name_ka: null,
  trail_cover_image_url: null,
  ...extra,
});

describe('feedAction', () => {
  it('says what happened for each kind of post', () => {
    expect(feedAction('completion')).toBe('completed');
    expect(feedAction('photo')).toBe('added a photo on');
    expect(feedAction('condition')).toBe('reported conditions on');
    expect(feedAction('review')).toBe('reviewed');
    expect(feedAction('something-new')).toBe('was on');
  });
});

describe('feedMedia', () => {
  it('shows a completion’s hike photos, without repeats', () => {
    expect(
      feedMedia(item({ photo_urls: ['p1', 'p2', 'p1'], photo_url: 'p1' })),
    ).toEqual({ urls: ['p1', 'p2'], kind: 'photos' });
  });

  it('falls back to the single photo (e.g. the proof photo) when a completion has no hike photos', () => {
    expect(feedMedia(item({ photo_urls: [], photo_url: 'proof' }))).toEqual({ urls: ['proof'], kind: 'photos' });
  });

  it('uses the trail cover for a completion without any photo', () => {
    expect(feedMedia(item({ trail_cover_image_url: 'cover' }))).toEqual({ urls: ['cover'], kind: 'cover' });
  });

  it('shows the photo of a photo or condition post, and nothing for a review', () => {
    expect(feedMedia(item({ activity_type: 'photo', photo_url: 'x', photo_urls: null }))).toEqual({
      urls: ['x'],
      kind: 'photos',
    });
    expect(feedMedia(item({ activity_type: 'condition', photo_url: null, trail_cover_image_url: 'cover' }))).toEqual({
      urls: [],
      kind: 'none',
    });
    expect(feedMedia(item({ activity_type: 'review', trail_cover_image_url: 'cover' }))).toEqual({
      urls: [],
      kind: 'none',
    });
  });
});

describe('labels', () => {
  it('counts likes, and says nothing for none', () => {
    expect(likesLabel(0)).toBe('');
    expect(likesLabel(1)).toBe('1 like');
    expect(likesLabel(1204)).toBe('1,204 likes');
  });

  it('links to the comments only when there are some', () => {
    expect(commentsLinkLabel(0)).toBeNull();
    expect(commentsLinkLabel(1)).toBe('View 1 comment');
    expect(commentsLinkLabel(12)).toBe('View all 12 comments');
  });

  it('names conditions readably', () => {
    expect(conditionLabel('fallen_tree')).toBe('Fallen tree');
    expect(conditionLabel('rock_fall')).toBe('Rock fall');
    expect(conditionLabel(null)).toBe('');
  });

  it('reads a review’s stars from its text', () => {
    expect(reviewStars('4')).toBe(4);
    expect(reviewStars('9')).toBe(5);
    expect(reviewStars('-2')).toBe(0);
    expect(reviewStars(null)).toBe(0);
  });

  it('formats a hike’s time', () => {
    expect(formatElapsed(45 * 60)).toBe('45 min');
    expect(formatElapsed(4 * 3600 + 20 * 60)).toBe('4h 20m');
    expect(formatElapsed(3 * 3600)).toBe('3h');
  });
});

describe('completionChips', () => {
  const trail = { distance_km: 12.4, elevation_gain_m: 860 };

  it('shows the trail’s distance and ascent when the post has no numbers of its own', () => {
    expect(completionChips(item(), trail).map((c) => c.label)).toEqual(['12.4 km', '860 m']);
  });

  it('prefers the hike’s own numbers and adds its time', () => {
    const chips = completionChips(item({ distance_km: 13.1, elevation_gain_m: 902, elapsed_seconds: 5 * 3600 + 5 * 60 }), trail);
    expect(chips.map((c) => c.label)).toEqual(['13.1 km', '902 m', '5h 5m']);
  });

  it('marks a past hike “before the app”, with no time', () => {
    const chips = completionChips(item({ source: 'past', elapsed_seconds: 3600 }), trail);
    expect(chips.map((c) => c.key)).toEqual(['distance', 'ascent', 'past']);
    expect(chips[2].label).toBe('Hiked before the app');
  });

  it('shows nothing it does not know, and nothing for other kinds of post', () => {
    expect(completionChips(item(), undefined)).toEqual([]);
    expect(completionChips(item({ activity_type: 'photo' }), trail)).toEqual([]);
  });
});

describe('shareMessage', () => {
  it('says who did what and links to the trail', () => {
    expect(shareMessage(item())).toBe(
      'nino completed Juta to Roshka on Mikiri Trails.\n\nmikiri-trails://trail/t1',
    );
  });
});
