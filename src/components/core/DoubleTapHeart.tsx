import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { tokens } from '@/theme/tokens';

interface DoubleTapHeartProps {
  isVisible: boolean;
  x: number;
  y: number;
  onAnimationEnd: () => void;
}

const PARTICLE_COUNT = 6;

export const DoubleTapHeart: React.FC<DoubleTapHeartProps> = ({
  isVisible,
  x,
  y,
  onAnimationEnd,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const particleOpacity = useSharedValue(0);
  const particleScale = useSharedValue(0);

  const triggerAnimation = useCallback(() => {
    scale.value = 0;
    opacity.value = 1;
    rotation.value = (Math.random() - 0.5) * 30;
    particleOpacity.value = 1;
    particleScale.value = 0;

    scale.value = withSequence(
      withSpring(1.2, { stiffness: 400, damping: 8 }),
      withSpring(1, { stiffness: 200, damping: 15 })
    );

    particleScale.value = withSpring(1.5, { stiffness: 300, damping: 12 });
    particleOpacity.value = withDelay(400, withTiming(0, { duration: 300 }));

    opacity.value = withDelay(
      600,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) }, () => {
        runOnJS(onAnimationEnd)();
      })
    );
  }, [scale, opacity, rotation, particleOpacity, particleScale, onAnimationEnd]);

  useEffect(() => {
    if (isVisible) {
      triggerAnimation();
    }
  }, [isVisible, triggerAnimation]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const particleContainerStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
    transform: [{ scale: particleScale.value }],
  }));

  if (!isVisible) return null;

  return (
    <View style={[styles.container, { left: x - 40, top: y - 40 }]} pointerEvents="none">
      <Animated.View style={[styles.heartContainer, heartStyle]}>
        <Animated.Text style={styles.heart}>❤️</Animated.Text>
      </Animated.View>
      <Animated.View style={[styles.particleContainer, particleContainerStyle]}>
        {Array.from({ length: PARTICLE_COUNT }).map((_, index) => {
          const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
          const radius = 30;
          return (
            <View
              key={index}
              style={[
                styles.particle,
                {
                  left: 40 + Math.cos(angle) * radius - 4,
                  top: 40 + Math.sin(angle) * radius - 4,
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 80,
    height: 80,
    zIndex: 999,
  },
  heartContainer: {
    position: 'absolute',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heart: {
    fontSize: 60,
  },
  particleContainer: {
    position: 'absolute',
    width: 80,
    height: 80,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.brand.primary,
  },
});
