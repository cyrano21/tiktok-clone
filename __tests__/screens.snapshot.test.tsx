import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-video', () => 'Video');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-gesture-handler', () => 'GestureHandler');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

describe('Screen Snapshots', () => {
  it('should render ExploreScreen without crashing', () => {
    const { ExploreScreen } = require('../src/screens/ExploreScreen');
    const { toJSON } = render(<ExploreScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render ProfileScreen without crashing', () => {
    const { ProfileScreen } = require('../src/screens/ProfileScreen');
    const { toJSON } = render(<ProfileScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render LoginScreen without crashing', () => {
    const { LoginScreen } = require('../src/screens/auth/LoginScreen');
    const { toJSON } = render(<LoginScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
