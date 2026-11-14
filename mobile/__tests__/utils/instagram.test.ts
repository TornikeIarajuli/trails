import { instagramUrl, parseInstagramHandle } from '../../utils/instagram';

describe('parseInstagramHandle', () => {
  it('takes usernames, @usernames and pasted links', () => {
    expect(parseInstagramHandle('nino_hikes')).toBe('nino_hikes');
    expect(parseInstagramHandle(' @nino.hikes ')).toBe('nino.hikes');
    expect(parseInstagramHandle('https://www.instagram.com/nino_hikes/?igsh=x')).toBe('nino_hikes');
    expect(parseInstagramHandle('instagram.com/Nino')).toBe('Nino');
  });

  it('removes on empty and refuses what Instagram would not allow', () => {
    expect(parseInstagramHandle('   ')).toBeNull();
    expect(parseInstagramHandle('nino hikes')).toBeUndefined();
    expect(parseInstagramHandle('nino-hikes')).toBeUndefined();
    expect(parseInstagramHandle('a'.repeat(31))).toBeUndefined();
  });

  it('links to the profile', () => {
    expect(instagramUrl('nino_hikes')).toBe('https://instagram.com/nino_hikes');
  });
});
