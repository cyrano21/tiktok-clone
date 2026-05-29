import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const tokens = {
  screen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, isSmallDevice: SCREEN_WIDTH < 375 },
  colors: {
    black: '#000000',
    white: '#FFFFFF',
    bg: '#121212',
    elevated: '#1E1E1E',
    card: '#2A2A2A',
    surface: '#363636',
    overlay: 'rgba(0,0,0,0.6)',
    brand: {
      primary: '#FE2C55',
      secondary: '#25F4EE',
      gradient: ['#FE2C55', '#FF0050'] as [string, string],
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#8A8B91',
      tertiary: '#5B5C61',
      link: '#2D8CF0',
    },
    semantic: {
      success: '#2ED573',
      warning: '#FFA502',
      error: '#FF4757',
      live: '#FF4444',
      verified: '#25F4EE',
    },
    action: {
      like: '#FE2C55',
      comment: '#FFFFFF',
      share: '#FFFFFF',
      save: '#FFFFFF',
      tip: '#FFD700',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  typography: {
    caption: { fontSize: 12, lineHeight: 16 },
    body: { fontSize: 14, lineHeight: 20 },
    subhead: { fontSize: 16, lineHeight: 22 },
    title: { fontSize: 18, lineHeight: 24 },
    headline: { fontSize: 24, lineHeight: 30 },
    display: { fontSize: 32, lineHeight: 38 },
  },
  animation: {
    fast: 200,
    normal: 300,
    slow: 400,
    entrance: 600,
    likeSpring: { stiffness: 300, damping: 15 },
    swipeSpring: { stiffness: 250, damping: 20 },
  },
  bottomNav: { height: 56, iconSize: 24, createButtonSize: 48 },
  feed: {
    aspectRatio: 9 / 16,
    rightBarWidth: 56,
    rightBarIconSize: 32,
    infoPadding: 16,
    progressBarHeight: 2,
  },
} as const;

export type Tokens = typeof tokens;
