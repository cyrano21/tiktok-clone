import { View, TouchableOpacity } from 'react-native';

export const GestureHandlerRootView = View;
export const GestureDetector = ({ children }: any) => children;
export const Gesture = {
  Pan: () => ({ activeOffsetY: () => ({ onEnd: () => ({}) }), onEnd: () => ({}) }),
  Tap: () => ({ numberOfTaps: () => ({ maxDelay: () => ({ onEnd: () => ({}) }), onEnd: () => ({}) }), onEnd: () => ({}) }),
  Race: (...args: any[]) => args[0],
  Simultaneous: (...args: any[]) => args[0],
  Exclusive: (...args: any[]) => args[0],
};
export { TouchableOpacity };
