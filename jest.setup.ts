// Keep Jest focused on the web renderer used by this Next.js app.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native-web');
  const React = jest.requireActual('react');
  return {
    ...actual,
    TouchableOpacity: ({
      children,
      onPress,
      disabled,
      testID,
      style,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      activeOpacity: _activeOpacity,
      hitSlop: _hitSlop,
      ...props
    }: any) => React.createElement(
      'button',
      {
        ...props,
        type: 'button',
        disabled,
        'data-testid': testID,
        'aria-label': accessibilityLabel,
        'aria-pressed': accessibilityState?.selected,
        role: accessibilityRole === 'button' ? 'button' : undefined,
        onClick: onPress,
        style,
      },
      children
    ),
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock native-only reanimated for web component tests.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedStyle: () => ({}),
  withSpring: (value: unknown) => value,
  withTiming: (value: unknown) => value,
  runOnJS: (fn: Function) => fn,
  Easing: { linear: (value: unknown) => value },
}));

// Mock AsyncStorage (used by api.ts) — avoids pulling react-native-web into jsdom
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      multiRemove: jest.fn(async (keys: string[]) => {
        keys.forEach((k) => delete store[k]);
      }),
    },
  };
});
