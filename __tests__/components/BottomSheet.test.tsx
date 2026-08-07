import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { BottomSheet } from '../../src/components/shared/BottomSheet';
import { Text } from 'react-native';


jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'div' },
  useSharedValue: jest.fn((val) => ({ value: val })),
  useAnimatedStyle: jest.fn(() => ({})),
  withSpring: jest.fn((val) => val),
  withTiming: jest.fn((val) => val),
  runOnJS: jest.fn((fn) => fn),
  Easing: { ease: (value) => value, inOut: (value) => value },
}));

describe('BottomSheet', () => {
  it('renders its children when visible', () => {
    const { getByText } = render(
      <BottomSheet isVisible={true} onClose={jest.fn()}>
        <Text>Content</Text>
      </BottomSheet>
    );

    expect(getByText('Content')).toBeTruthy();
  });

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn();
    const { container } = render(
      <BottomSheet isVisible={true} onClose={onClose}>
        <Text>Content</Text>
      </BottomSheet>
    );

    fireEvent.click(container.querySelector('[testid="bottom-sheet-backdrop"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
