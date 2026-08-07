import React from 'react';
import { render } from '@testing-library/react';
import { NavigationProvider } from '../src/navigation/NavigationContext';

jest.mock('react-native-video', () => 'Video', { virtual: true });
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedStyle: () => ({}),
  withSpring: (value: unknown) => value,
  withTiming: (value: unknown) => value,
}));
jest.mock('react-native-gesture-handler', () => 'GestureHandler', { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

describe('Screen Snapshots', () => {
  it('should render ExploreScreen without crashing', () => {
    const { ExploreScreen } = require('../src/screens/ExploreScreen');
    const { container } = render(<NavigationProvider><ExploreScreen /></NavigationProvider>);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render ProfileScreen without crashing', () => {
    const { ProfileScreen } = require('../src/screens/ProfileScreen');
    const { container } = render(<NavigationProvider><ProfileScreen /></NavigationProvider>);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render LoginScreen without crashing', () => {
    const { LoginScreen } = require('../src/screens/auth/LoginScreen');
    const { container } = render(<NavigationProvider><LoginScreen /></NavigationProvider>);
    expect(container.firstChild).toBeTruthy();
  });
});
