import { localName } from '../../utils/i18n';

describe('localName', () => {
  it('returns English name when lang is "en"', () => {
    expect(localName('Kazbegi Loop', 'ყაზბეგის მარყუჟი', 'en')).toBe('Kazbegi Loop');
  });

  it('returns Georgian name when lang is "ka" and Georgian name exists', () => {
    expect(localName('Kazbegi Loop', 'ყაზბეგის მარყუჟი', 'ka')).toBe('ყაზბეგის მარყუჟი');
  });

  it('falls back to English when lang is "ka" but Georgian name is null', () => {
    expect(localName('Kazbegi Loop', null, 'ka')).toBe('Kazbegi Loop');
  });

  it('falls back to English when lang is "ka" but Georgian name is undefined', () => {
    expect(localName('Kazbegi Loop', undefined, 'ka')).toBe('Kazbegi Loop');
  });

  it('falls back to English when lang is "ka" but Georgian name is empty string', () => {
    expect(localName('Kazbegi Loop', '', 'ka')).toBe('Kazbegi Loop');
  });

  it('returns English name for any unrecognised language code', () => {
    expect(localName('Kazbegi Loop', 'ყაზბეგის მარყუჟი', 'fr')).toBe('Kazbegi Loop');
  });
});
