import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const tokens = {
  // Screen dimensions
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isSmallDevice: SCREEN_WIDTH < 375,
    isMediumDevice: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
    isLargeDevice: SCREEN_WIDTH >= 414,
  },

  // Backward compatibility aliases for colors (old structure)
  colors: {
    black: '#000000',
    white: '#FFFFFF',
    bg: '#09090F',
    elevated: '#10101A',
    card: '#15151F',
    surface: '#22222F',
    overlay: 'rgba(0, 0, 0, 0.5)',
    brand: {
      primary: '#7C3AED',
      secondary: '#F72585',
      violet: '#5B21B6',
      magenta: '#FF2D87',
      gradient: ['#5B21B6', '#7C3AED', '#F72585'] as [string, string, string],
    },
    text: {
      primary: '#F8F8FC',
      secondary: '#9A9AA8',
      tertiary: '#686879',
      link: '#A78BFA',
    },
    semantic: {
      success: '#2ED573',
      warning: '#FFA502',
      error: '#FF4757',
      live: '#FF4444',
      verified: '#A78BFA',
    },
    action: {
      like: '#F72585',
      comment: '#FFFFFF',
      share: '#FFFFFF',
      save: '#FFFFFF',
      tip: '#FFD700',
    },
  },

  // Spacing tokens — 4pt scale
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96,
    // Semantic aliases
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border radius tokens
  radius: {
    none: 0,
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },

  // Typography tokens
  typography: {
    // Font families
    fontFamily: {
      display: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      body: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      mono: 'SF Mono, Fira Code, Consolas, monospace',
    },

    // Font sizes
    fontSize: {
      xs: 11,
      sm: 13,
      base: 15,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      display: 48,
    },

    // Line heights
    lineHeight: {
      tight: 1.2,
      snug: 1.3,
      normal: 1.5,
      relaxed: 1.6,
      loose: 1.8,
    },

    // Font weights
    fontWeight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      extrabold: '800' as const,
    },

    // Letter spacing
    letterSpacing: {
      tighter: -0.05,
      tight: -0.025,
      normal: 0,
      wide: 0.025,
      wider: 0.05,
      widest: 0.1,
    },

    // Text styles (pre-composed)
    caption: { fontSize: 11, lineHeight: 16, fontWeight: '400' as const },
    bodySmall: { fontSize: 13, lineHeight: 20, fontWeight: '400' as const },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
    bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    subhead: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const },
    title: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
    headline: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
    display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const },
    hero: { fontSize: 48, lineHeight: 56, fontWeight: '800' as const },
  },

  // Shadow tokens
  shadow: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, 0.3)',
    sm: '0 2px 4px rgba(0, 0, 0, 0.3)',
    md: '0 4px 12px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.6)',
    glow: '0 0 20px rgba(124, 58, 237, 0.28)',
    glowStrong: '0 0 40px rgba(247, 37, 133, 0.42)',
  },

  // Animation tokens (backward compatible)
  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
    entrance: 600,
    likeSpring: { stiffness: 300, damping: 15 },
    swipeSpring: { stiffness: 250, damping: 20 },
  },

  // Feed tokens (backward compatible)
  feed: {
    aspectRatio: 9 / 16,
    rightBarWidth: 56,
    rightBarIconSize: 32,
    infoPadding: 16,
    progressBarHeight: 2,
  },

  // Bottom navigation tokens
  bottomNav: {
    height: 56,
    iconSize: 24,
    createButtonSize: 48,
  },
} as const;

export type Tokens = typeof tokens;
