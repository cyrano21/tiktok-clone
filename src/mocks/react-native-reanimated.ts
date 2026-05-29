import React from 'react';
import { View, Text, ScrollView, Image, FlatList } from 'react-native';

// Minimal reanimated v3 mock for web. No real animation — just no-ops that
// preserve component composition so the UI renders.

const Animated: any = {
  View,
  Text,
  ScrollView,
  Image,
  FlatList,
  createAnimatedComponent: <T,>(component: T): T => component,
};

export default Animated;

export const useSharedValue = <T,>(initial: T) => ({ value: initial });
export const useAnimatedStyle = (factory: () => any) => {
  try { return factory(); } catch { return {}; }
};
export const useDerivedValue = <T,>(factory: () => T) => ({ value: factory() });
export const useAnimatedRef = () => React.createRef();
export const useAnimatedScrollHandler = () => () => {};

export const withSpring = <T,>(value: T) => value as T;
export const withTiming = <T,>(value: T) => value as T;
export const withDelay = <T,>(_d: number, value: T) => value as T;
export const withSequence = (...args: any[]) => args[args.length - 1];
export const withRepeat = <T,>(value: T) => value as T;

export const runOnJS = (fn: any) => fn;
export const runOnUI = (fn: any) => fn;

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  in: (e: any) => e,
  out: (e: any) => e,
  inOut: (e: any) => e,
  bezier: () => (t: number) => t,
};

export const interpolate = (value: number, input: number[], output: number[]) => {
  if (!input || input.length < 2) return value;
  const i = Math.max(0, Math.min(input.length - 2, input.findIndex((v) => value < v) - 1));
  const safeIndex = i < 0 ? 0 : i;
  const t = (value - input[safeIndex]) / (input[safeIndex + 1] - input[safeIndex] || 1);
  return output[safeIndex] + t * (output[safeIndex + 1] - output[safeIndex]);
};

export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
export const Extrapolate = Extrapolation;

export const FadeIn = { duration: () => ({}), delay: () => ({}) } as any;
export const FadeOut = { duration: () => ({}), delay: () => ({}) } as any;
