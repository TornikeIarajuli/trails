import { buildMapsShareLink, buildSmsUrl, buildSosSmsBody } from '../../utils/links';

describe('SOS text message', () => {
  it('puts a maps link for the position in the message', () => {
    expect(buildMapsShareLink(42.6655, 44.6146)).toBe('https://maps.google.com/?q=42.665500,44.614600');
    expect(buildSosSmsBody({ lat: 42.6655, lng: 44.6146 })).toBe(
      'I need help. My location: https://maps.google.com/?q=42.665500,44.614600',
    );
  });

  it('keeps the sign of southern and western coordinates', () => {
    expect(buildMapsShareLink(-33.8688, -70.6693)).toBe('https://maps.google.com/?q=-33.868800,-70.669300');
  });

  it('still produces a message without a position', () => {
    expect(buildSosSmsBody(null)).toContain('I need help');
  });

  it('builds the sms: link each platform expects', () => {
    expect(buildSmsUrl('I need help. A&B', 'ios')).toBe('sms:&body=I%20need%20help.%20A%26B');
    expect(buildSmsUrl('I need help. A&B', 'android')).toBe('sms:?body=I%20need%20help.%20A%26B');
  });
});
