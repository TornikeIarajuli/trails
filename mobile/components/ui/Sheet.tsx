import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';

export const SHEET_SPRING = { damping: 28, stiffness: 280, mass: 1, overshootClamping: true } as const;
export const SHEET_EXIT_MS = 220;
export const BACKDROP_COLOR = 'rgba(0,0,0,0.45)';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
// See the keyboard handling in SheetPanel
const KEYBOARD_EVENT_WAIT_MS = 600;
const ESTIMATED_KEYBOARD_SHARE = 0.45;
const ESTIMATED_KEYBOARD_MIN = 300;
/** Android: a keyboard event has arrived for an input inside a sheet, so they can be relied on. */
let keyboardEventsReachSheets = false;

/**
 * While a sheet or dialog animates out, its parent has often already cleared what it
 * showed (`badge` back to null…). This keeps the value from when it was last visible.
 */
export function useLastVisibleValue<T>(value: T, visible: boolean): T {
  const last = useRef(value);
  if (visible) last.current = value;
  return visible ? value : last.current;
}

interface SheetContextValue {
  /** Animates the sheet out, then calls `then` instead of the sheet's onClose. */
  dismiss: (then?: () => void) => void;
  onInputFocus: (input: TextInput | null) => void;
  onInputBlur: () => void;
}

const SheetContext = createContext<SheetContextValue | null>(null);

/** For content inside a Sheet: closes it the animated way, like the backdrop or the X. */
export function useSheet(): Pick<SheetContextValue, 'dismiss'> {
  const sheet = useContext(SheetContext);
  return useMemo(() => ({ dismiss: (then?: () => void) => (sheet ? sheet.dismiss(then) : then?.()) }), [sheet]);
}

export interface SheetProps {
  visible: boolean;
  /**
   * Called after the sheet has animated out because the user closed it: backdrop,
   * close button, swipe down or the Android back button. Set `visible` to false in it.
   */
  onClose: () => void;
  title?: string;
  /** Next to the title, before the close button (for example "Clear all"). */
  headerRight?: React.ReactNode;
  /** Shown by default when there is a title. */
  showCloseButton?: boolean;
  closeLabel?: string;
  /** Stays at the bottom while the body scrolls; for the action buttons. */
  footer?: React.ReactNode;
  /** false: nothing the user does closes the sheet (while something is being saved). */
  dismissible?: boolean;
  closeOnBackdropPress?: boolean;
  /** The body scrolls (default). false when it brings its own list. */
  scrollable?: boolean;
  /** Short sheets without a scrolling body: swipe down anywhere, not only on the handle and header. */
  dragAnywhere?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}

/**
 * Bottom sheet on a transparent Modal: fading backdrop, spring in, swipe or tap
 * outside to close, header and sticky footer, keeps inputs above the keyboard.
 * It always animates out before calling onClose or disappearing.
 */
export function Sheet(props: SheetProps) {
  // Mounted from the moment it should show until its closing animation has finished
  const [mounted, setMounted] = useState(props.visible);
  if (props.visible && !mounted) setMounted(true);
  const handleHidden = useCallback(() => setMounted(false), []);
  if (!mounted) return null;
  return <SheetPanel {...props} onHidden={handleHidden} />;
}

function SheetPanel({
  visible,
  onClose,
  onHidden,
  title,
  headerRight,
  showCloseButton,
  closeLabel = 'Close',
  footer,
  dismissible = true,
  closeOnBackdropPress = true,
  scrollable = true,
  dragAnywhere = false,
  contentContainerStyle,
  testID,
  children,
}: SheetProps & { onHidden: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(windowHeight);
  const sheetHeight = useSharedValue(windowHeight);
  const keyboardLift = useSharedValue(0);
  // Read by the swipe gesture, which must not take over a sheet that is already leaving
  const isClosing = useSharedValue(false);

  const laidOut = useRef(false);
  const closing = useRef(false);
  const afterClose = useRef<(() => void) | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finish = useCallback(
    (byUser: boolean) => {
      closing.current = false;
      const then = afterClose.current;
      afterClose.current = null;
      onHidden();
      if (then) then();
      else if (byUser) onCloseRef.current();
    },
    [onHidden],
  );

  const show = useCallback(() => {
    closing.current = false;
    isClosing.value = false;
    afterClose.current = null;
    translateY.value = reduceMotion ? 0 : withSpring(0, SHEET_SPRING);
  }, [isClosing, reduceMotion, translateY]);

  const hide = useCallback(
    (byUser: boolean, then?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      isClosing.value = true;
      afterClose.current = then ?? null;
      Keyboard.dismiss();
      const offscreen = sheetHeight.value + keyboardLift.value + 24;
      translateY.value = withTiming(
        offscreen,
        { duration: reduceMotion ? 0 : SHEET_EXIT_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finish)(byUser);
        },
      );
    },
    [finish, isClosing, keyboardLift, reduceMotion, sheetHeight, translateY],
  );

  // Opening waits for the first layout, so the sheet starts right below the screen edge
  useEffect(() => {
    if (visible) {
      if (laidOut.current) show();
    } else {
      hide(false);
    }
  }, [visible, show, hide]);

  const onLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    sheetHeight.value = height;
    if (!laidOut.current) {
      laidOut.current = true;
      if (visibleRef.current) {
        translateY.value = height;
        show();
      }
    }
  };

  const requestClose = useCallback(() => {
    if (dismissible) hide(true);
  }, [dismissible, hide]);

  const backdropCloses = closeOnBackdropPress && dismissible;
  const onBackdropPress = useCallback(() => {
    if (backdropCloses) hide(true);
  }, [backdropCloses, hide]);

  const dismiss = useCallback((then?: () => void) => hide(true, then), [hide]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  // iOS reports the keyboard reliably. Android draws modals edge to edge, so their
  // window no longer shrinks for the keyboard, and its keyboard events come from the
  // main window and may not report a keyboard opened inside this one. If an input in
  // the sheet is focused and no event arrives, a keyboard of typical height is assumed
  // so the input is not left underneath it; a real event always takes over.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [focusCount, setFocusCount] = useState(0);
  const [estimating, setEstimating] = useState(false);
  const focusedInput = useRef<TextInput | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event: KeyboardEvent) => {
      if (focusedInput.current) keyboardEventsReachSheets = true;
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !inputFocused || keyboardHeight > 0 || keyboardEventsReachSheets) {
      setEstimating(false);
      return;
    }
    const timer = setTimeout(() => setEstimating(true), KEYBOARD_EVENT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [inputFocused, keyboardHeight]);

  // Android's events leave out the navigation bar, which the keyboard sits on
  const lift =
    keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === 'android' ? insets.bottom : 0)
      : estimating
        ? Math.max(ESTIMATED_KEYBOARD_MIN, Math.round(windowHeight * ESTIMATED_KEYBOARD_SHARE))
        : 0;

  useEffect(() => {
    keyboardLift.value = withTiming(lift, { duration: reduceMotion ? 0 : 200 });
  }, [lift, keyboardLift, reduceMotion]);

  // Once the sheet has made room, bring the focused input into view inside the body
  useEffect(() => {
    if (lift === 0) return;
    const timer = setTimeout(() => {
      const input = focusedInput.current;
      const content = contentRef.current;
      const scroll = scrollRef.current;
      if (!input || !content || !scroll) return;
      (input as unknown as { measureLayout: (...args: unknown[]) => void }).measureLayout(
        content,
        (_x: number, y: number) => scroll.scrollTo({ y: Math.max(0, y - 24), animated: !reduceMotion }),
        () => {}, // the input is outside the body (in the footer): nothing to scroll
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [lift, focusCount, reduceMotion]);

  const context = useMemo<SheetContextValue>(
    () => ({
      dismiss,
      onInputFocus: (input) => {
        focusedInput.current = input;
        setInputFocused(true);
        setFocusCount((count) => count + 1);
      },
      onInputBlur: () => {
        focusedInput.current = null;
        setInputFocused(false);
      },
    }),
    [dismiss],
  );

  // ── Swipe down ─────────────────────────────────────────────────────────────
  const closeFromSwipe = useCallback(() => hide(true), [hide]);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(`${testID ?? 'sheet'}-pan`)
        .activeOffsetY([-10, 10])
        .failOffsetX([-24, 24])
        .onUpdate((event) => {
          if (isClosing.value) return;
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (isClosing.value) return;
          const far = event.translationY > Math.min(DISMISS_DISTANCE, sheetHeight.value * 0.35);
          if (dismissible && (far || event.velocityY > DISMISS_VELOCITY)) {
            runOnJS(closeFromSwipe)();
          } else {
            translateY.value = withSpring(0, SHEET_SPRING);
          }
        }),
    [closeFromSwipe, dismissible, isClosing, sheetHeight, testID, translateY],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, sheetHeight.value], [1, 0], Extrapolation.CLAMP),
  }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: keyboardLift.value }));

  const maxHeight = Math.max(160, Math.min(windowHeight * 0.9, windowHeight - lift - insets.top - 12));
  // The keyboard covers the home indicator / navigation bar while it is open
  const bottomPadding = (lift > 0 ? 0 : insets.bottom) + 12;
  const closeButton = showCloseButton ?? !!title;
  const hasHeader = !!title || !!headerRight || closeButton;

  const dragArea = (
    <View style={[styles.dragArea, !hasHeader && styles.dragAreaBare]}>
      <View style={styles.handle} />
      {hasHeader && (
        <View style={styles.header}>
          {title ? (
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View style={styles.titleSpacer} />
          )}
          {headerRight}
          {closeButton && (
            <TouchableOpacity
              onPress={requestClose}
              disabled={!dismissible}
              hitSlop={10}
              style={!dismissible && styles.disabled}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              accessibilityState={{ disabled: !dismissible }}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const body = scrollable ? (
    <ScrollView
      ref={scrollRef}
      style={styles.body}
      contentContainerStyle={[styles.bodyContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View ref={contentRef} collapsable={false}>
        {children}
      </View>
    </ScrollView>
  ) : (
    <View style={[styles.body, styles.bodyContent, contentContainerStyle]}>{children}</View>
  );

  const content = (
    <>
      {dragAnywhere ? dragArea : <GestureDetector gesture={pan}>{dragArea}</GestureDetector>}
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.root}>
        <SheetContext.Provider value={context}>
          <Animated.View style={[styles.overlay, liftStyle]}>
            <Animated.View style={[styles.backdrop, backdropStyle]}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={onBackdropPress}
                disabled={!backdropCloses}
                accessibilityRole={backdropCloses ? 'button' : undefined}
                accessibilityLabel={backdropCloses ? closeLabel : undefined}
                accessibilityElementsHidden={!backdropCloses}
                importantForAccessibility={backdropCloses ? 'auto' : 'no-hide-descendants'}
              />
            </Animated.View>
            <Animated.View
              testID={testID}
              onLayout={onLayout}
              accessibilityViewIsModal
              onAccessibilityEscape={requestClose}
              style={[styles.panel, { maxHeight, paddingBottom: bottomPadding }, panelStyle]}
            >
              {dragAnywhere ? (
                <GestureDetector gesture={pan}>
                  <View style={styles.dragWrap}>{content}</View>
                </GestureDetector>
              ) : (
                content
              )}
            </Animated.View>
          </Animated.View>
        </SheetContext.Provider>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** A TextInput that tells its Sheet when it is focused, so the sheet can keep it above the keyboard. */
export const SheetTextInput = forwardRef<TextInput, TextInputProps>(function SheetTextInput(
  { onFocus, onBlur, ...props },
  ref,
) {
  const sheet = useContext(SheetContext);
  const inner = useRef<TextInput | null>(null);
  const setRef = useCallback(
    (node: TextInput | null) => {
      inner.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <TextInput
      {...props}
      ref={setRef}
      onFocus={(event) => {
        onFocus?.(event);
        sheet?.onInputFocus(inner.current);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        sheet?.onInputBlur();
      }}
    />
  );
});

interface SheetButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** A spinner in place of the title. */
  loading?: boolean;
  /** A spinner next to the title. */
  busy?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

/** The action button of a sheet or dialog footer, so every sheet has the same button row. */
export function SheetButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  busy = false,
  testID,
  accessibilityLabel,
}: SheetButtonProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  const spinnerColor = primary ? Colors.textOnPrimary : Colors.primary;

  return (
    <TouchableOpacity
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonSecondary, inactive && styles.disabled]}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading || busy }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {busy && <ActivityIndicator size="small" color={spinnerColor} />}
          <Text style={[styles.buttonText, primary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: BACKDROP_COLOR,
    },
    panel: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    dragWrap: {
      flexShrink: 1,
    },
    dragArea: {
      paddingTop: 10,
    },
    dragAreaBare: {
      paddingBottom: 10,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 32,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
    },
    titleSpacer: {
      flex: 1,
    },
    body: {
      flexShrink: 1,
    },
    bodyContent: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 8,
    },
    button: {
      minHeight: 50,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 20,
    },
    buttonPrimary: {
      backgroundColor: Colors.primary,
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
    },
    buttonText: {
      fontSize: 16,
    },
    buttonTextPrimary: {
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    buttonTextSecondary: {
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    disabled: {
      opacity: 0.5,
    },
  });
