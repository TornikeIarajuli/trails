import { validatePassword } from '../../utils/passwordRules';

describe('validatePassword', () => {
  it('accepts a password that meets every rule', () => {
    expect(validatePassword('Kazbegi2026')).toBeNull();
    expect(validatePassword('Aa1aaaaa')).toBeNull();
    expect(validatePassword(`Aa1${'x'.repeat(69)}`)).toBeNull();
  });

  it('rejects fewer than 8 characters', () => {
    expect(validatePassword('Aa1aaaa')).toMatch(/at least 8/);
    expect(validatePassword('')).toMatch(/at least 8/);
  });

  it('rejects more than 72 characters', () => {
    expect(validatePassword(`Aa1${'x'.repeat(70)}`)).toMatch(/at most 72/);
  });

  it('requires an uppercase letter, a lowercase letter and a number', () => {
    expect(validatePassword('kazbegi2026')).toMatch(/uppercase/);
    expect(validatePassword('KAZBEGI2026')).toMatch(/lowercase/);
    expect(validatePassword('KazbegiPeak')).toMatch(/number/);
  });
});
