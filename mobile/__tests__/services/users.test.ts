jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from '../../services/api';
import { usersService } from '../../services/users';

const mockGet = api.get as jest.Mock;
const mockPatch = api.patch as jest.Mock;
const mockPost = api.post as jest.Mock;
const mockDelete = (api as any).delete as jest.Mock;
const ok = (data: unknown) => Promise.resolve({ data });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usersService.deleteAccount', () => {
  it('calls DELETE /users/me', async () => {
    mockDelete.mockResolvedValueOnce(ok(undefined));
    await usersService.deleteAccount();
    expect(mockDelete).toHaveBeenCalledWith('/users/me');
  });

  it('returns void on success', async () => {
    mockDelete.mockResolvedValueOnce(ok(undefined));
    const result = await usersService.deleteAccount();
    expect(result).toBeUndefined();
  });

  it('propagates a server error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(usersService.deleteAccount()).rejects.toThrow('Unauthorized');
  });
});

describe('usersService.sendSos', () => {
  it('calls POST /users/me/sos with lat and lng', async () => {
    mockPost.mockResolvedValueOnce(ok(undefined));
    await usersService.sendSos(41.69, 44.83);
    expect(mockPost).toHaveBeenCalledWith('/users/me/sos', { lat: 41.69, lng: 44.83 });
  });

  it('returns void on success', async () => {
    mockPost.mockResolvedValueOnce(ok(undefined));
    const result = await usersService.sendSos(0, 0);
    expect(result).toBeUndefined();
  });

  it('propagates a network error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network Error'));
    await expect(usersService.sendSos(41.69, 44.83)).rejects.toThrow('Network Error');
  });

  it('accepts zero coordinates', async () => {
    mockPost.mockResolvedValueOnce(ok(undefined));
    await usersService.sendSos(0, 0);
    expect(mockPost).toHaveBeenCalledWith('/users/me/sos', { lat: 0, lng: 0 });
  });
});

describe('usersService.setEmergencyContact', () => {
  it('calls PATCH /users/me/emergency-contact with the contact user id', async () => {
    mockPatch.mockResolvedValueOnce(ok(undefined));
    await usersService.setEmergencyContact('user-abc');
    expect(mockPatch).toHaveBeenCalledWith('/users/me/emergency-contact', {
      contact_user_id: 'user-abc',
    });
  });

  it('passes null to clear the emergency contact', async () => {
    mockPatch.mockResolvedValueOnce(ok(undefined));
    await usersService.setEmergencyContact(null);
    expect(mockPatch).toHaveBeenCalledWith('/users/me/emergency-contact', {
      contact_user_id: null,
    });
  });
});

describe('usersService.getMyProfile', () => {
  it('calls GET /users/me', async () => {
    mockGet.mockResolvedValueOnce(ok({ id: 'u1', username: 'tbilisi_hiker' }));
    await usersService.getMyProfile();
    expect(mockGet).toHaveBeenCalledWith('/users/me');
  });

  it('returns the profile object', async () => {
    const profile = { id: 'u1', username: 'tbilisi_hiker', full_name: 'Test User' };
    mockGet.mockResolvedValueOnce(ok(profile));
    const result = await usersService.getMyProfile();
    expect(result).toEqual(profile);
  });
});
