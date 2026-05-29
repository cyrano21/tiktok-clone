import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BottomSheet } from '../../src/components/shared/BottomSheet';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useSharedValue: jest.fn((val) => ({ value: val })),
  useAnimatedStyle: jest.fn(() => ({})),
  withSpring: jest.fn((val) => val),
  withTiming: jest.fn((val) => val),
}));

describe('BottomSheet', () => {
  it('should render when visible', () => {
    const { getByText } = render(
      <BottomSheet visible={true} onClose={jest.fn()} title="Test Sheet">
        <Text>Content</Text>
      </BottomSheet>
    );

    expect(getByText('Test Sheet')).toBeTruthy();
    expect(getByText('Content')).toBeTruthy();
  });

  it('should show close button and call onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <BottomSheet visible={true} onClose={onClose} title="Test">
        <Text>Content</Text>
      </BottomSheet>
    );

    fireEvent.press(getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
