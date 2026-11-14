/**
 * The bottom sheet and dialog every modal in the app is built on: they open, they close
 * from the backdrop, the close button, a swipe or the back button, and they always slide or
 * fade away before onClose runs or their content disappears.
 */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React, { useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { PanGesture, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import {
  SHEET_EXIT_MS,
  Sheet,
  SheetButton,
  SheetProps,
  SheetTextInput,
  useLastVisibleValue,
  useSheet,
  estimatedKeyboardLift,
} from '../../components/ui/Sheet';
import { DIALOG_EXIT_MS, Dialog } from '../../components/ui/Dialog';
import { ActionSheet } from '../../components/ui/ActionSheet';
import { BadgeUnlockModal } from '../../components/badges/BadgeUnlockModal';
import { Badge } from '../../types/badge';

let renderer: ReactTestRenderer | null = null;

function textOf(node: ReactTestInstance): string {
  return ([] as unknown[])
    .concat(node.props.children)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('');
}

const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(textOf) : []);

const pressables = (label: string) =>
  renderer!.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

/** The dimmed background, which covers the whole screen behind the panel or card. */
const backdrop = () =>
  renderer!.root.findAll((n) => n.props.style === StyleSheet.absoluteFill && typeof n.props.onPress === 'function')[0];
const closeButton = (label = 'Close') => pressables(label).filter((n) => n.props.hitSlop === 10)[0];
const modal = () => renderer!.root.findAll((n) => typeof n.props.onRequestClose === 'function')[0];

function press(node: ReactTestInstance) {
  act(() => {
    node.props.onPress();
  });
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** On a device the panel reports its size once drawn, which starts the slide in. */
function layOut(testID = 'sheet', height = 400) {
  const panel = renderer!.root.findAll((n) => n.props.testID === testID && typeof n.props.onLayout === 'function')[0];
  act(() => {
    panel.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 750, height } } });
  });
}

function panelMaxHeight(testID = 'sheet'): number {
  const panel = renderer!.root.findAll((n) => n.props.testID === testID && n.props.style)[0];
  const parts = ([] as unknown[]).concat(panel.props.style) as Record<string, unknown>[];
  const sized = parts.find((part) => part && typeof part === 'object' && 'maxHeight' in part);
  return sized?.maxHeight as number;
}

interface HarnessProps extends Partial<SheetProps> {
  initiallyOpen?: boolean;
  onUserClose?: () => void;
}

/** A screen that opens and hides a sheet the way the app's screens do. */
function Harness({ initiallyOpen = true, onUserClose, children, ...props }: HarnessProps) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <TouchableOpacity accessibilityLabel="Open sheet" onPress={() => setOpen(true)} />
      <TouchableOpacity accessibilityLabel="Hide sheet" onPress={() => setOpen(false)} />
      <Sheet
        testID="sheet"
        visible={open}
        title="Trail notes"
        footer={<SheetButton title="Save" onPress={() => {}} />}
        onClose={() => {
          onUserClose?.();
          setOpen(false);
        }}
        {...props}
      >
        {children ?? <Text>Sheet body</Text>}
      </Sheet>
    </>
  );
}

function render(element: React.ReactElement) {
  act(() => {
    renderer = TestRenderer.create(element);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
});

describe('Sheet', () => {
  it('shows its title, body and footer only while open', () => {
    render(<Harness initiallyOpen={false} />);
    expect(shown()).not.toContain('Sheet body');

    press(pressables('Open sheet')[0]);
    expect(shown()).toEqual(expect.arrayContaining(['Trail notes', 'Sheet body', 'Save']));
  });

  it('closes from the backdrop after sliding away, and only then calls onClose', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} />);
    layOut();

    expect(backdrop().props.accessibilityLabel).toBe('Close');
    press(backdrop());
    advance(SHEET_EXIT_MS - 60);
    expect(onUserClose).not.toHaveBeenCalled();
    expect(shown()).toContain('Sheet body');

    advance(200);
    expect(onUserClose).toHaveBeenCalledTimes(1);
    expect(shown()).not.toContain('Sheet body');
  });

  it('closes from its close button the same way', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} />);

    press(closeButton());
    expect(onUserClose).not.toHaveBeenCalled();
    expect(shown()).toContain('Sheet body');

    advance(400);
    expect(onUserClose).toHaveBeenCalledTimes(1);
    expect(shown()).not.toContain('Sheet body');
  });

  it('springs back from a short drag, and closes when swiped down far enough', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} />);
    layOut();
    advance(1000);

    const swipe = (translationY: number, velocityY: number) =>
      act(() => {
        fireGestureHandler<PanGesture>(getByGestureTestId('sheet-pan'), [
          { state: State.BEGAN, translationY: 0, velocityY: 0 },
          { state: State.ACTIVE, translationY: translationY / 2, velocityY },
          { state: State.ACTIVE, translationY, velocityY },
          { state: State.END, translationY, velocityY },
        ]);
      });

    swipe(40, 100);
    advance(1000);
    expect(onUserClose).not.toHaveBeenCalled();
    expect(shown()).toContain('Sheet body');

    swipe(200, 300);
    expect(shown()).toContain('Sheet body');
    advance(400);
    expect(onUserClose).toHaveBeenCalledTimes(1);
    expect(shown()).not.toContain('Sheet body');
  });

  it('closes when flicked down, however short the drag', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} />);
    layOut();
    advance(1000);

    act(() => {
      fireGestureHandler<PanGesture>(getByGestureTestId('sheet-pan'), [
        { state: State.BEGAN, translationY: 0, velocityY: 0 },
        { state: State.ACTIVE, translationY: 30, velocityY: 1500 },
        { state: State.END, translationY: 30, velocityY: 1500 },
      ]);
    });
    advance(400);
    expect(onUserClose).toHaveBeenCalledTimes(1);
  });

  it('cannot be swiped away while it is not dismissible', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} dismissible={false} />);
    layOut();
    advance(1000);

    act(() => {
      fireGestureHandler<PanGesture>(getByGestureTestId('sheet-pan'), [
        { state: State.BEGAN, translationY: 0, velocityY: 0 },
        { state: State.ACTIVE, translationY: 300, velocityY: 2000 },
        { state: State.END, translationY: 300, velocityY: 2000 },
      ]);
    });
    advance(1000);
    expect(onUserClose).not.toHaveBeenCalled();
    expect(shown()).toContain('Sheet body');
  });

  it('closes on the Android back button', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} />);

    act(() => modal().props.onRequestClose());
    advance(400);
    expect(onUserClose).toHaveBeenCalledTimes(1);
    expect(shown()).not.toContain('Sheet body');
  });

  it('cannot be closed while it is not dismissible', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} dismissible={false} />);

    expect(closeButton().props.disabled).toBe(true);
    press(backdrop());
    press(closeButton());
    act(() => modal().props.onRequestClose());
    advance(400);

    expect(onUserClose).not.toHaveBeenCalled();
    expect(shown()).toContain('Sheet body');
  });

  it('can leave the backdrop out of closing it, keeping the close button', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} closeOnBackdropPress={false} />);

    expect(backdrop().props.disabled).toBe(true);
    press(backdrop());
    advance(400);
    expect(shown()).toContain('Sheet body');

    press(closeButton());
    advance(400);
    expect(onUserClose).toHaveBeenCalledTimes(1);
  });

  it('slides away when its screen hides it, without calling onClose', () => {
    const onUserClose = jest.fn();
    render(<Harness onUserClose={onUserClose} />);
    layOut();

    press(pressables('Hide sheet')[0]);
    expect(shown()).toContain('Sheet body');

    advance(400);
    expect(shown()).not.toContain('Sheet body');
    expect(onUserClose).not.toHaveBeenCalled();
  });

  it('stays open when it is opened again while sliding away', () => {
    render(<Harness />);
    layOut();

    press(pressables('Hide sheet')[0]);
    advance(80);
    press(pressables('Open sheet')[0]);
    advance(1000);

    expect(shown()).toContain('Sheet body');
  });

  it('lets its content close it the animated way, running an action instead of onClose', () => {
    const onUserClose = jest.fn();
    const chosen = jest.fn();

    function Choice({ onDone }: { onDone: () => void }) {
      const sheet = useSheet();
      return (
        <TouchableOpacity accessibilityLabel="Choose" onPress={() => sheet.dismiss(onDone)}>
          <Text>Choose</Text>
        </TouchableOpacity>
      );
    }

    function ChoiceScreen() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet visible={open} onClose={onUserClose} testID="sheet">
          <Choice
            onDone={() => {
              chosen();
              setOpen(false);
            }}
          />
        </Sheet>
      );
    }

    render(<ChoiceScreen />);
    press(pressables('Choose')[0]);
    expect(chosen).not.toHaveBeenCalled();
    expect(shown()).toContain('Choose');

    advance(400);
    expect(chosen).toHaveBeenCalledTimes(1);
    expect(onUserClose).not.toHaveBeenCalled();
    expect(shown()).not.toContain('Choose');
  });

  it('makes room for the keyboard the system reports', () => {
    const full = Dimensions.get('window').height * 0.9;
    render(<Harness />);
    expect(panelMaxHeight()).toBeCloseTo(full);

    act(() => {
      DeviceEventEmitter.emit('keyboardWillShow', { endCoordinates: { height: 300, screenY: 0, screenX: 0, width: 750 } });
    });
    expect(panelMaxHeight()).toBe(Dimensions.get('window').height - 300 - 12);

    act(() => {
      DeviceEventEmitter.emit('keyboardWillHide', { endCoordinates: { height: 0, screenY: 0, screenX: 0, width: 750 } });
    });
    expect(panelMaxHeight()).toBeCloseTo(full);
  });

  describe('on Android', () => {
    const os = Platform.OS;
    beforeEach(() => {
      Platform.OS = 'android';
    });
    afterEach(() => {
      Platform.OS = os;
    });

    it('assumes a keyboard over a focused input when none is reported', () => {
      const height = Dimensions.get('window').height;
      render(
        <Harness>
          <SheetTextInput accessibilityLabel="Notes" />
        </Harness>,
      );
      const input = renderer!.root.findAll(
        (n) => n.props.accessibilityLabel === 'Notes' && typeof n.props.onFocus === 'function',
      )[0];

      act(() => input.props.onFocus({ nativeEvent: {} }));
      advance(500);
      expect(panelMaxHeight()).toBeCloseTo(height * 0.9);

      advance(200);
      // Includes the navigation bar the keyboard sits on (0 in this test)
      const estimated = estimatedKeyboardLift(height, 0);
      expect(panelMaxHeight()).toBe(height - estimated - 12);

      act(() => input.props.onBlur({ nativeEvent: {} }));
      expect(panelMaxHeight()).toBeCloseTo(height * 0.9);
    });
  });
});

describe('SheetButton', () => {
  it('shows a spinner instead of its title while loading, and cannot be pressed', () => {
    const onPress = jest.fn();
    render(<SheetButton title="Send report" onPress={onPress} loading testID="send" />);
    const button = renderer!.root.findAll(
      (n) => n.props.testID === 'send' && n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function',
    )[0];

    expect(button.props.disabled).toBe(true);
    expect(shown()).not.toContain('Send report');
    expect(renderer!.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });

  it('can show a spinner beside its title', () => {
    render(<SheetButton title="Show trails" onPress={() => {}} busy />);
    expect(shown()).toContain('Show trails');
    expect(renderer!.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });
});

describe('useLastVisibleValue', () => {
  function Probe({ value, visible }: { value: string | null; visible: boolean }) {
    return <Text>{useLastVisibleValue(value, visible) ?? 'nothing'}</Text>;
  }

  it('keeps the last value shown while closing, and follows it again once open', () => {
    render(<Probe value="Summit Seeker" visible />);
    act(() => renderer!.update(<Probe value={null} visible={false} />));
    expect(shown()).toEqual(['Summit Seeker']);

    act(() => renderer!.update(<Probe value="Lake Lover" visible />));
    expect(shown()).toEqual(['Lake Lover']);
  });
});

describe('Dialog', () => {
  function DialogScreen({ onUserClose, closeOnBackdropPress }: { onUserClose: () => void; closeOnBackdropPress?: boolean }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <TouchableOpacity accessibilityLabel="Hide dialog" onPress={() => setOpen(false)} />
        <Dialog
          visible={open}
          closeOnBackdropPress={closeOnBackdropPress}
          onClose={() => {
            onUserClose();
            setOpen(false);
          }}
        >
          <Text>Badge unlocked</Text>
        </Dialog>
      </>
    );
  }

  it('closes from the backdrop after fading away, and only then calls onClose', () => {
    const onUserClose = jest.fn();
    render(<DialogScreen onUserClose={onUserClose} />);
    expect(shown()).toContain('Badge unlocked');
    advance(300); // it has popped in

    press(backdrop());
    advance(DIALOG_EXIT_MS - 60);
    expect(onUserClose).not.toHaveBeenCalled();
    expect(shown()).toContain('Badge unlocked');

    advance(200);
    expect(onUserClose).toHaveBeenCalledTimes(1);
    expect(shown()).not.toContain('Badge unlocked');
  });

  it('can ignore the backdrop and still close on the Android back button', () => {
    const onUserClose = jest.fn();
    render(<DialogScreen onUserClose={onUserClose} closeOnBackdropPress={false} />);

    expect(backdrop().props.disabled).toBe(true);
    press(backdrop());
    advance(400);
    expect(shown()).toContain('Badge unlocked');

    act(() => modal().props.onRequestClose());
    advance(400);
    expect(onUserClose).toHaveBeenCalledTimes(1);
    expect(shown()).not.toContain('Badge unlocked');
  });

  it('fades away when its screen hides it, without calling onClose', () => {
    const onUserClose = jest.fn();
    render(<DialogScreen onUserClose={onUserClose} />);
    advance(300);

    press(pressables('Hide dialog')[0]);
    advance(DIALOG_EXIT_MS - 60);
    expect(shown()).toContain('Badge unlocked');

    advance(200);
    expect(shown()).not.toContain('Badge unlocked');
    expect(onUserClose).not.toHaveBeenCalled();
  });
});

describe('ActionSheet', () => {
  const options = [
    { key: 'saved', label: 'Saved' },
    { key: 'favorites', label: 'Favorites' },
  ];

  /** Mounted only while open, like the bookmark and moderation menus. */
  function MenuScreen(props: {
    closeOnSelect?: boolean;
    loading?: boolean;
    onSelect: (key: string) => void;
    onClose: () => void;
  }) {
    const [open, setOpen] = useState(true);
    return open ? (
      <ActionSheet
        visible
        title="Save to list"
        options={options}
        loading={props.loading}
        closeOnSelect={props.closeOnSelect}
        onSelect={(key) => {
          props.onSelect(key);
          if (props.closeOnSelect) setOpen(false);
        }}
        onClose={() => {
          props.onClose();
          setOpen(false);
        }}
      />
    ) : null;
  }

  it('with closeOnSelect, slides away first and then reports the choice', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    render(<MenuScreen closeOnSelect onSelect={onSelect} onClose={onClose} />);

    press(pressables('Favorites')[0]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(shown()).toContain('Save to list');

    advance(400);
    expect(onSelect).toHaveBeenCalledWith('favorites');
    expect(onClose).not.toHaveBeenCalled();
    expect(shown()).toEqual([]);
  });

  it('without it, reports the choice at once and stays open for the next step', () => {
    const onSelect = jest.fn();
    render(<MenuScreen onSelect={onSelect} onClose={jest.fn()} />);

    press(pressables('Saved')[0]);
    expect(onSelect).toHaveBeenCalledWith('saved');
    advance(400);
    expect(shown()).toContain('Save to list');
  });

  it('cancels the animated way, and not while a choice is being carried out', () => {
    const onClose = jest.fn();
    render(<MenuScreen loading onSelect={jest.fn()} onClose={onClose} />);
    const cancel = () =>
      renderer!.root.findAll((n) => n.props.accessibilityLabel === 'Cancel' && n.props.accessibilityRole === 'button')[0];
    expect(cancel().props.disabled).toBe(true);

    act(() => renderer!.unmount());
    render(<MenuScreen onSelect={jest.fn()} onClose={onClose} />);
    press(cancel());
    expect(onClose).not.toHaveBeenCalled();
    advance(400);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(shown()).toEqual([]);
  });
});

describe('BadgeUnlockModal', () => {
  const badge = (id: string, name: string): Badge => ({
    id,
    key: id,
    name_en: name,
    name_ka: null,
    description_en: `${name} description`,
    description_ka: null,
    icon: 'trophy',
    category: 'special',
    threshold: null,
    region: null,
    difficulty: null,
    sort_order: 0,
  });

  function Screen({ badges }: { badges: Badge[] }) {
    const [unlocked, setUnlocked] = useState<Badge[]>(badges);
    return (
      <>
        <TouchableOpacity accessibilityLabel="Unlock again" onPress={() => setUnlocked([badge('b-3', 'Ridge Runner')])} />
        <BadgeUnlockModal badges={unlocked} visible={unlocked.length > 0} onClose={() => setUnlocked([])} />
      </>
    );
  }

  const pressText = (label: string) => {
    let node: ReactTestInstance | null = renderer!.root.findAllByType(Text).find((t) => textOf(t) === label) ?? null;
    while (node && typeof node.props.onPress !== 'function') node = node.parent;
    press(node!);
  };

  it('steps through the badges, keeps the last one on screen while it fades out, and starts over next time', () => {
    render(<Screen badges={[badge('b-1', 'Summit Seeker'), badge('b-2', 'Lake Lover')]} />);
    expect(shown()).toEqual(expect.arrayContaining(['1 / 2', 'Summit Seeker', 'Next Badge']));

    pressText('Next Badge');
    expect(shown()).toEqual(expect.arrayContaining(['2 / 2', 'Lake Lover', 'Awesome!']));

    // The screen clears its badges at once; the dialog still shows the badge while it fades
    pressText('Awesome!');
    expect(shown()).toContain('Lake Lover');
    advance(400);
    expect(shown()).not.toContain('Lake Lover');

    press(pressables('Unlock again')[0]);
    expect(shown()).toContain('Ridge Runner');
    expect(shown()).not.toContain('1 / 2');
  });
});

describe('estimatedKeyboardLift', () => {
  it('adds the navigation bar to a generous keyboard estimate', () => {
    expect(estimatedKeyboardLift(800, 48)).toBe(Math.round(800 * 0.48) + 48);
    expect(estimatedKeyboardLift(500, 0)).toBe(320);
  });
});
