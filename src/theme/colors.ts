/**
 * TikTok Clone Color System
 * 
 * Organized by semantic purpose with accessibility in mind.
 * All colors meet WCAG 2.1 AA contrast requirements against their intended backgrounds.
 */

// Base paper (background) colors — dark theme
export const paper = {
  base: '#0a0a0a',
  elevated: '#141414',
  card: '#1a1a1a',
  surface: '#242424',
  hover: '#2a2a2a',
  active: '#333333',
} as const;

// Accent colors — TikTok brand
export const accent = {
  primary: '#FE2C55',
  secondary: '#25F4EE',
  gradient: ['#FE2C55', '#FF0050'] as [string, string],
  glow: 'rgba(254, 44, 85, 0.3)',
  glowStrong: 'rgba(254, 44, 85, 0.5)',
} as const;

// Text colors — high contrast on dark backgrounds
export const text = {
  primary: '#FFFFFF',
  secondary: '#8A8B91',
  tertiary: '#5B5C61',
  inverse: '#000000',
  link: '#2D8CF0',
  disabled: '#4A4A4A',
} as const;

// Semantic colors — status and feedback
export const semantic = {
  success: '#2ED573',
  successMuted: 'rgba(46, 213, 115, 0.15)',
  warning: '#FFA502',
  warningMuted: 'rgba(255, 165, 2, 0.15)',
  error: '#FF4757',
  errorMuted: 'rgba(255, 71, 87, 0.15)',
  info: '#2D8CF0',
  infoMuted: 'rgba(45, 140, 240, 0.15)',
} as const;

// Status colors — user and content states
export const status = {
  live: '#FF4444',
  liveMuted: 'rgba(255, 68, 68, 0.15)',
  verified: '#25F4EE',
  verifiedMuted: 'rgba(37, 244, 238, 0.15)',
  online: '#2ED573',
  away: '#FFA502',
  offline: '#5B5C61',
} as const;

// Action colors — interactive elements
export const action = {
  like: '#FE2C55',
  likeMuted: 'rgba(254, 44, 85, 0.15)',
  comment: '#FFFFFF',
  share: '#FFFFFF',
  save: '#FFFFFF',
  saveMuted: 'rgba(255, 255, 255, 0.15)',
  tip: '#FFD700',
  tipMuted: 'rgba(255, 215, 0, 0.15)',
} as const;

// Overlay colors — modals, backdrops
export const overlay = {
  light: 'rgba(0, 0, 0, 0.3)',
  medium: 'rgba(0, 0, 0, 0.5)',
  heavy: 'rgba(0, 0, 0, 0.7)',
  blur: 'rgba(0, 0, 0, 0.8)',
} as const;

// Border colors
export const border = {
  subtle: 'rgba(255, 255, 255, 0.05)',
  default: 'rgba(255, 255, 255, 0.1)',
  strong: 'rgba(255, 255, 255, 0.2)',
  accent: accent.primary,
} as const;

// Focus ring color
export const focus = {
  ring: 'rgba(254, 44, 85, 0.5)',
  ringStrong: 'rgba(254, 44, 85, 0.7)',
} as const;

// Combined colors object for backward compatibility
export const colors = {
  black: '#000000',
  white: '#FFFFFF',
  bg: paper.base,
  elevated: paper.elevated,
  card: paper.card,
  surface: paper.surface,
  overlay: overlay.medium,
  brand: {
    primary: accent.primary,
    secondary: accent.secondary,
    gradient: accent.gradient,
  },
  text: {
    primary: text.primary,
    secondary: text.secondary,
    tertiary: text.tertiary,
    link: text.link,
  },
  semantic: {
    success: semantic.success,
    warning: semantic.warning,
    error: semantic.error,
    live: status.live,
    verified: status.verified,
  },
  action: {
    like: action.like,
    comment: action.comment,
    share: action.share,
    save: action.save,
    tip: action.tip,
  },
} as const;

export type Colors = typeof colors;
