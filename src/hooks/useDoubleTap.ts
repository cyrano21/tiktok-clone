import { useCallback, useRef } from 'react';
import { GestureResponderEvent } from 'react-native';

interface DoubleTapOptions {
  maxDelay?: number;
  excludeRight?: boolean;
  onSingleTap?: (event: GestureResponderEvent) => void;
  onDoubleTap?: (event: GestureResponderEvent) => void;
}

export function useDoubleTap(options: DoubleTapOptions = {}) {
  const { maxDelay = 300, excludeRight = false, onSingleTap, onDoubleTap } = options;

  const lastTapRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventRef = useRef<GestureResponderEvent | null>(null);

  const handleTap = useCallback(
    (event: GestureResponderEvent) => {
      if (excludeRight) {
        const { locationX } = event.nativeEvent;
        const { width } = event.nativeEvent as unknown as { width: number };
        if (width && locationX > width * 0.7) {
          return;
        }
      }

      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < maxDelay && timeSinceLastTap > 0) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastTapRef.current = 0;
        onDoubleTap?.(event);
      } else {
        lastTapRef.current = now;
        lastEventRef.current = event;

        timerRef.current = setTimeout(() => {
          if (lastEventRef.current) {
            onSingleTap?.(lastEventRef.current);
          }
          lastTapRef.current = 0;
          timerRef.current = null;
        }, maxDelay);
      }
    },
    [maxDelay, excludeRight, onSingleTap, onDoubleTap]
  );

  return { onPress: handleTap };
}
