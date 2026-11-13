/**
 * The screen opened by the password-reset e-mail link, rendered with a mocked
 * link, router and API.
 */
const mockSecureStore = new Map<string, string>();
let mockLinkingUrl: string | null = null;

jest.mock('expo-linking', () => ({
  useLinkingURL: () => mockLinkingUrl,
  getLinkingURL: () => mockLinkingUrl,
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));
jest.mock('../../utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('../../services/auth', () => ({ authService: { updatePassword: jest.fn() } }));

import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import ResetPasswordScreen from '../../app/(auth)/reset-password';
import { authService } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';

const updatePassword = authService.updatePassword as jest.Mock;
const replace = router.replace as jest.Mock;

let link = 0;
/** Every test gets a link of its own: the screen remembers links it has used up. */
const recoveryUrl = () =>
  `mikiri-trails://reset-password#access_token=recovery-token-${++link}&refresh_token=r&type=recovery`;
const EXPIRED_URL =
  'mikiri-trails://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

function textOf(node: ReactTestInstance): string {
  return node.findAllByType(Text)
    .map((t) => t.props.children)
    .flat(Infinity)
    .filter((c) => typeof c === 'string')
    .join(' ');
}

async function render(url: string | null) {
  mockLinkingUrl = url;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<ResetPasswordScreen />);
  });
  return renderer.root;
}

function screenText(root: ReactTestInstance) {
  return textOf(root);
}

async function type(root: ReactTestInstance, placeholder: string, value: string) {
  const input = root.findAllByType(TextInput).find((i) => i.props.placeholder === placeholder);
  if (!input) throw new Error(`no input "${placeholder}"`);
  await act(async () => input.props.onChangeText(value));
}

async function press(root: ReactTestInstance, label: string) {
  const target = root
    .findAll((n) => typeof n.props.onPress === 'function' && textOf(n).includes(label))
    .pop();
  if (!target) throw new Error(`nothing to press labelled "${label}"`);
  await act(async () => {
    await target.props.onPress();
  });
}

async function fillIn(root: ReactTestInstance, password: string, repeat = password) {
  await type(root, 'Enter a new password', password);
  await type(root, 'Enter it again', repeat);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
});

describe('with a valid reset link', () => {
  it('asks for a new password', async () => {
    const root = await render(recoveryUrl());
    expect(screenText(root)).toContain('Choose a new password');
  });

  it('sets the new password with the token from the link and confirms it', async () => {
    const url = recoveryUrl();
    const token = /access_token=([^&]+)/.exec(url)![1];
    updatePassword.mockResolvedValueOnce({ message: 'Password updated' });
    const root = await render(url);

    await fillIn(root, 'Kazbegi2026');
    await press(root, 'Update Password');

    expect(updatePassword).toHaveBeenCalledWith(token, 'Kazbegi2026');
    expect(screenText(root)).toContain('Password updated');

    await press(root, 'Log In');
    expect(replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('applies the sign-up password rules before sending anything', async () => {
    const root = await render(recoveryUrl());

    await fillIn(root, 'short1A');
    await press(root, 'Update Password');
    expect(screenText(root)).toContain('at least 8 characters');

    await fillIn(root, 'kazbegi2026');
    await press(root, 'Update Password');
    expect(screenText(root)).toContain('uppercase letter');

    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('checks that both entries match', async () => {
    const root = await render(recoveryUrl());

    await fillIn(root, 'Kazbegi2026', 'Kazbegi2027');
    await press(root, 'Update Password');

    expect(screenText(root)).toContain('do not match');
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('shows the expired state when the server no longer accepts the token', async () => {
    updatePassword.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401, data: {} } });
    const root = await render(recoveryUrl());

    await fillIn(root, 'Kazbegi2026');
    await press(root, 'Update Password');

    expect(screenText(root)).toContain('This link has expired');
  });

  it('keeps the form and explains other failures', async () => {
    updatePassword.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { message: 'New password should be different from the old password.' } },
    });
    const root = await render(recoveryUrl());

    await fillIn(root, 'Kazbegi2026');
    await press(root, 'Update Password');

    expect(screenText(root)).toContain('New password should be different from the old password.');
    expect(screenText(root)).toContain('Choose a new password');
  });

  it('signs out a session this phone still holds, since the server ends it', async () => {
    useAuthStore.getState().setSession(
      { id: 'user-1', email: 'nino@example.com', user_metadata: { username: 'nino' } },
      'access-1',
      'refresh-1',
    );
    updatePassword.mockResolvedValueOnce({ message: 'Password updated' });
    const root = await render(recoveryUrl());

    await fillIn(root, 'Kazbegi2026');
    await press(root, 'Update Password');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('without a usable link', () => {
  it.each([
    ['an expired link', EXPIRED_URL],
    ['no link at all', null],
    ['a link without a token', 'mikiri-trails://reset-password'],
  ])('shows the expired state for %s and offers a new link', async (_name, url) => {
    const root = await render(url);

    expect(screenText(root)).toContain('This link has expired');
    await press(root, 'Request a New Link');
    expect(replace).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('does not offer the form again for a link that was already used', async () => {
    const url = recoveryUrl();
    updatePassword.mockResolvedValueOnce({ message: 'Password updated' });
    const first = await render(url);
    await fillIn(first, 'Kazbegi2026');
    await press(first, 'Update Password');

    const again = await render(url);

    expect(screenText(again)).toContain('This link has expired');
  });
});
