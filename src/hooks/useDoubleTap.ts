import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, GestureResponderEvent } from 'react-native';

interface DoubleTapOptions {
  maxDelay?: number;
  excludeRight?: boolean;
  onSingleTap?: (event: GestureResponderEvent) => void;
  onDoubleTap?: (event: GestureResponderEvent) => void;
}

function eventSurfaceWidth(event: GestureResponderEvent): number {
  const nativeWidth = Number((event.nativeEvent as unknown as { width?: number }).width ?? 0);
  if (nativeWidth > 0) return nativeWidth;

  const targetWidth = Number((event.target as unknown as { offsetWidth?: number } | null)?.offsetWidth ?? 0);
  if (targetWidth > 0) return targetWidth;

  return Dimensions.get('window').width;
}

export function useDoubleTap(options: DoubleTapOptions = {}) {
  const { maxDelay = 300, excludeRight = false, onSingleTap, onDoubleTap } = options;

  const lastTapRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventRef = useRef<GestureResponderEvent | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleTap = useCallback(
    (event: GestureResponderEvent) => {
      if (excludeRight) {
        const width = eventSurfaceWidth(event);
        if (width > 0 && event.nativeEvent.locationX > width * 0.7) return;
      }

      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < maxDelay && timeSinceLastTap > 0) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastTapRef.current = 0;
        lastEventRef.current = null;
        onDoubleTap?.(event);
        return;
      }

      lastTapRef.current = now;
      lastEventRef.current = event;
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        if (lastEventRef.current) onSingleTap?.(lastEventRef.current);
        lastEventRef.current = null;
        lastTapRef.current = 0;
        timerRef.current = null;
      }, maxDelay);
    },
    [maxDelay, excludeRight, onSingleTap, onDoubleTap]
  );

  // handlePress is kept as a compatibility alias for older callers/tests while
  // onPress remains the canonical Pressable/Touchable prop handler.
  return { onPress: handleTap, handlePress: handleTap };
}
