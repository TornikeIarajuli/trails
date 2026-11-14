import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, ColorPalette } from '../../constants/colors';
import { BACKDROP_COLOR } from './Sheet';

export const DIALOG_IN_MS = 180;
export const DIALOG_EXIT_MS = 160;
const POP_SPRING = { damping: 18, stiffness: 260, mass: 1 } as const;

interface DialogContextValue {
  /** Animates the dialog out, then calls `then` instead of the dialog's onClose. */
  dismiss: (then?: () => void) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

/** For content inside a Dialog: closes it the animated way. */
export function useDialog(): DialogContextValue {
  const dialog = useContext(DialogContext);
  return useMemo(() => ({ dismiss: (then?: () => void) => (dialog ? dialog.dismiss(then) : then?.()) }), [dialog]);
}

export interface DialogProps {
  visible: boolean;
  /**
   * Called after the dialog has animated out because the user closed it: backdrop or
   * the Android back button. Set `visible` to false in it.
   */
  onClose: () => void;
  /** false: nothing the user does closes the dialog. */
  dismissible?: boolean;
  closeOnBackdropPress?: boolean;
  closeLabel?: string;
  /** For the card: padding, alignment, width. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}

/**
 * Centred card on a transparent Modal, for confirmations and celebrations: the backdrop
 * fades, the card pops in, and it always animates out before onClose or disappearing.
 */
export function Dialog(props: DialogProps) {
  const [mounted, setMounted] = useState(props.visible);
  if (props.visible && !mounted) setMounted(true);
  const handleHidden = useCallback(() => setMounted(false), []);
  if (!mounted) return null;
  return <DialogCard {...props} onHidden={handleHidden} />;
}

function DialogCard({
  visible,
  onClose,
  onHidden,
  dismissible = true,
  closeOnBackdropPress = true,
  closeLabel = 'Close',
  style,
  testID,
  children,
}: DialogProps & { onHidden: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.92);

  const closing = useRef(false);
  const afterClose = useRef<(() => void) | null>(null);
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
    afterClose.current = null;
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : DIALOG_IN_MS, easing: Easing.out(Easing.cubic) });
    scale.value = reduceMotion ? 1 : withSpring(1, POP_SPRING);
  }, [progress, reduceMotion, scale]);

  const hide = useCallback(
    (byUser: boolean, then?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      afterClose.current = then ?? null;
      const timing = { duration: reduceMotion ? 0 : DIALOG_EXIT_MS, easing: Easing.in(Easing.cubic) };
      scale.value = withTiming(reduceMotion ? 1 : 0.96, timing);
      progress.value = withTiming(0, timing, (finished) => {
        if (finished) runOnJS(finish)(byUser);
      });
    },
    [finish, progress, reduceMotion, scale],
  );

  useEffect(() => {
    if (visible) show();
    else hide(false);
  }, [visible, show, hide]);

  const requestClose = useCallback(() => {
    if (dismissible) hide(true);
  }, [dismissible, hide]);

  const backdropCloses = closeOnBackdropPress && dismissible;
  const onBackdropPress = useCallback(() => {
    if (backdropCloses) hide(true);
  }, [backdropCloses, hide]);

  const context = useMemo<DialogContextValue>(() => ({ dismiss: (then) => hide(true, then) }), [hide]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: scale.value }] }));

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={requestClose}>
      <DialogContext.Provider value={context}>
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onBackdropPress}
              disabled={!backdropCloses}
              accessibilityRole={backdropCloses ? 'button' : undefined}
              accessibilityLabel={backdropCloses ? closeLabel : undefined}
              importantForAccessibility={backdropCloses ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={!backdropCloses}
            />
          </Animated.View>
          <Animated.View
            testID={testID}
            accessibilityViewIsModal
            onAccessibilityEscape={requestClose}
            style={[styles.card, style, cardStyle]}
          >
            {children}
          </Animated.View>
        </View>
      </DialogContext.Provider>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: BACKDROP_COLOR,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      maxHeight: '100%',
      backgroundColor: Colors.surface,
      borderRadius: 24,
      padding: 24,
    },
  });
