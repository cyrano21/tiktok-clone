import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableWithoutFeedback, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { tokens } from '@/theme/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  height?: number;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  height = SCREEN_HEIGHT * 0.6,
  children,
}) => {
  const translateY = useSharedValue(height);
  const backdropOpacity = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  useEffect(() => {
    if (isVisible) {
      translateY.value = withSpring(0, { stiffness: 300, damping: 25 });
      backdropOpacity.value = withTiming(1, { duration: tokens.animation.normal });
    } else {
      translateY.value = withTiming(height, {
        duration: tokens.animation.normal,
        easing: Easing.inOut(Easing.ease),
      });
      backdropOpacity.value = withTiming(0, { duration: tokens.animation.fast });
    }
  }, [isVisible, height, translateY, backdropOpacity]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event: any) => {
      translateY.value = Math.max(0, context.value.y + event.translationY);
    })
    .onEnd((event: any) => {
      if (event.translationY > height * 0.3 || event.velocityY > 500) {
        translateY.value = withTiming(height, { duration: tokens.animation.normal });
        backdropOpacity.value = withTiming(0, { duration: tokens.animation.fast });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { stiffness: 300, damping: 25 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View testID="bottom-sheet-backdrop" style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.sheet, { height }, sheetStyle]}>
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.overlay,
  },
  sheet: {
    backgroundColor: tokens.colors.elevated,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    paddingTop: tokens.spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.surface,
    alignSelf: 'center',
    marginBottom: tokens.spacing.md,
  },
});
