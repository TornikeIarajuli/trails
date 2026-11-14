/**
 * The occupation line / border watch during a hike: the banner state, a buzz when the hike
 * screen is in front, a notification when it is not, one alert per level, and a fresh start
 * for every hike.
 */
jest.mock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn(() => Promise.resolve('n1')) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Warning: 'warning' },
}));
jest.mock('../../utils/borderLines', () => {
  const actual = jest.requireActual('../../utils/borderLines');
  return { ...actual, checkLines: jest.fn() };
});

import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { checkLines } from '../../utils/borderLines';
import { processFix, resetLineWatch, setLineWarningScreen, useLineWarning } from '../../utils/lineWatch';

const check = checkLines as jest.Mock;
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const buzz = Haptics.notificationAsync as jest.Mock;

const occupationAt = (distanceM: number) => ({
  occupation: { name_en: 'Tskhinvali region', name_ka: null, distanceM, inside: false },
  borderM: null,
});
const nothing = { occupation: null, borderM: null };

const settle = () => new Promise((resolve) => setImmediate(resolve));
const hike = { hikeKey: 'hike-1', trailId: 't1' };

let appState: string;
beforeAll(() => {
  Object.defineProperty(AppState, 'currentState', { get: () => appState, configurable: true });
});

beforeEach(() => {
  jest.clearAllMocks();
  resetLineWatch();
  setLineWarningScreen(false);
  appState = 'background';
});

it('shows the warning and sends a notification while the phone is in a pocket', async () => {
  check.mockReturnValue(occupationAt(1200));

  const warning = processFix(42.08, 44.0, hike);
  await settle();

  expect(warning?.title).toBe('Occupation line about 1200 m away');
  expect(useLineWarning.getState().warning?.level).toBe('occupation');
  expect(schedule).toHaveBeenCalledWith({
    content: expect.objectContaining({
      title: 'Occupation line about 1200 m away',
      data: { type: 'line_warning', level: 'occupation', trailId: 't1' },
    }),
    trigger: { channelId: 'default' },
  });
  expect(buzz).not.toHaveBeenCalled();
});

it('buzzes instead when the hike screen is in front', async () => {
  setLineWarningScreen(true);
  appState = 'active';
  check.mockReturnValue(occupationAt(300));

  processFix(42.09, 44.0, hike);
  await settle();

  expect(buzz).toHaveBeenCalledWith('warning');
  expect(schedule).not.toHaveBeenCalled();
});

it('alerts once per level, keeps the banner up to date, and clears it once the line is far', async () => {
  check.mockReturnValue(occupationAt(1200));
  processFix(42.08, 44.0, hike);
  check.mockReturnValue(occupationAt(1100));
  expect(processFix(42.08, 44.0, hike)).toBeNull();
  expect(useLineWarning.getState().warning?.title).toBe('Occupation line about 1100 m away');

  check.mockReturnValue(nothing);
  processFix(42.0, 44.0, hike);
  await settle();

  expect(schedule).toHaveBeenCalledTimes(1);
  expect(useLineWarning.getState().warning).toBeNull();
});

it('starts over for a new hike', async () => {
  check.mockReturnValue(occupationAt(1200));
  processFix(42.08, 44.0, hike);
  expect(processFix(42.08, 44.0, { ...hike, hikeKey: 'hike-2' })).not.toBeNull();
  await settle();
  expect(schedule).toHaveBeenCalledTimes(2);
});

it('ignores a fix without a position', () => {
  expect(processFix(NaN, 44, hike)).toBeNull();
  expect(check).not.toHaveBeenCalled();
});

it('never lets a failed notification break the recording', async () => {
  schedule.mockRejectedValueOnce(new Error('no permission'));
  check.mockReturnValue(occupationAt(400));

  expect(() => processFix(42.09, 44.0, hike)).not.toThrow();
  await settle();
});
