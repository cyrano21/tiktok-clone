import { View, TouchableOpacity } from 'react-native';

export const GestureHandlerRootView = View;
export const GestureDetector = ({ children }: any) => children;

/**
 * Chainable no-op gesture builder for web. Every configuration/handler method
 * returns the same builder so the fluent API used by components
 * (`Gesture.Pan().onStart(...).onUpdate(...).onEnd(...)`) typechecks and runs
 * without real gesture handling (web uses native scroll/touch instead).
 */
type GestureBuilder = {
  [key: string]: (...args: any[]) => GestureBuilder;
};

function createGestureBuilder(): GestureBuilder {
  const builder = new Proxy(
    {},
    {
      get() {
        return (..._args: any[]) => builder;
      },
    },
  ) as GestureBuilder;
  return builder;
}

export const Gesture = {
  Pan: createGestureBuilder,
  Tap: createGestureBuilder,
  LongPress: createGestureBuilder,
  Pinch: createGestureBuilder,
  Fling: createGestureBuilder,
  Race: (...args: any[]) => args[0],
  Simultaneous: (...args: any[]) => args[0],
  Exclusive: (...args: any[]) => args[0],
};

export { TouchableOpacity };
