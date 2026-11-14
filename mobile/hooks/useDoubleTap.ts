import { useCallback, useEffect, useRef } from 'react';

/** How close two taps must be to count as a double tap. */
export const DOUBLE_TAP_MS = 280;

/**
 * A press handler that tells a double tap from a single one. The single-tap action waits until
 * a second tap can no longer come; a double tap cancels it. Taps that keep coming right after
 * a double tap count as more double taps, so tapping fast never ends in a single-tap action.
 */
export function useDoubleTap({
  onDoubleTap,
  onSingleTap,
  delay = DOUBLE_TAP_MS,
}: {
  onDoubleTap: () => void;
  onSingleTap?: () => void;
  delay?: number;
}): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAt = useRef(0);
  const lastDoubleAt = useRef(-Infinity);
  const handlers = useRef({ onDoubleTap, onSingleTap });
  handlers.current = { onDoubleTap, onSingleTap };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    const now = Date.now();
    const doubleTap = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      lastDoubleAt.current = now;
      handlers.current.onDoubleTap();
    };

    if (now - lastDoubleAt.current <= delay) {
      doubleTap();
      return;
    }
    if (timer.current && now - lastTapAt.current <= delay) {
      doubleTap();
      return;
    }
    lastTapAt.current = now;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      handlers.current.onSingleTap?.();
    }, delay);
  }, [delay]);
}
