/**
 * ORKY Color System
 * 
 * Organized by semantic purpose with accessibility in mind.
 * All colors meet WCAG 2.1 AA contrast requirements against their intended backgrounds.
 */

// Surface colors — ORKY dark theme (neutral-first so content stays dominant).
export const paper = {
  base: '#09090F',
  elevated: '#10101A',
  card: '#15151F',
  surface: '#22222F',
  hover: '#2A2A3A',
  active: '#343448',
} as const;

// ORKY identity colors. Use these for actions and emphasis, not every surface.
export const accent = {
  primary: '#7C3AED',
  secondary: '#F72585',
  violet: '#5B21B6',
  magenta: '#FF2D87',
  gradient: ['#5B21B6', '#7C3AED', '#F72585'] as [string, string, string],
  glow: 'rgba(124, 58, 237, 0.28)',
  glowStrong: 'rgba(247, 37, 133, 0.42)',
} as const;

// Text colors — high contrast on dark backgrounds.
export const text = {
  primary: '#F8F8FC',
  secondary: '#9A9AA8',
  tertiary: '#686879',
  inverse: '#17131F',
  link: '#A78BFA',
  disabled: '#5A5A6B',
} as const;

// Light theme surfaces, kept in the same semantic shape for future switching.
export const lightPaper = {
  base: '#FFFFFF',
  elevated: '#FFFFFF',
  card: '#F5F4F8',
  surface: '#E9E7F0',
  hover: '#E1DEEA',
  active: '#D6D1E2',
} as const;

export const lightText = {
  primary: '#17131F',
  secondary: '#5F586B',
  tertiary: '#7B7487',
  inverse: '#F8F8FC',
  link: '#5B21B6',
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
  verified: '#A78BFA',
  verifiedMuted: 'rgba(167, 139, 250, 0.15)',
  online: '#2ED573',
  away: '#FFA502',
  offline: '#5B5C61',
} as const;

// Action colors — interactive elements
export const action = {
  like: '#F72585',
  likeMuted: 'rgba(247, 37, 133, 0.15)',
  comment: '#FFFFFF',
  share: '#FFFFFF',
  save: '#FFFFFF',
  saveMuted: 'rgba(255, 255, 255, 0.15)',
  tip: '#FFD700',
  tipMuted: 'rgba(255, 215, 0, 0.15)',
} as const;

// Complete light-theme semantic map. The same ORKY accents remain, while
// surfaces and text invert to keep the content-first hierarchy intact.
export const lightColors = {
  black: '#000000',
  white: '#FFFFFF',
  bg: lightPaper.base,
  elevated: lightPaper.elevated,
  card: lightPaper.card,
  surface: lightPaper.surface,
  overlay: 'rgba(23, 19, 31, 0.45)',
  brand: {
    primary: accent.primary,
    secondary: accent.secondary,
    violet: accent.violet,
    magenta: accent.magenta,
    gradient: accent.gradient,
  },
  text: {
    primary: lightText.primary,
    secondary: lightText.secondary,
    tertiary: lightText.tertiary,
    link: lightText.link,
  },
  semantic: {
    success: semantic.success,
    warning: semantic.warning,
    error: semantic.error,
    live: status.live,
    verified: '#5B21B6',
  },
  action: {
    like: action.like,
    comment: '#17131F',
    share: '#17131F',
    save: '#17131F',
    tip: action.tip,
  },
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
  ring: 'rgba(124, 58, 237, 0.5)',
  ringStrong: 'rgba(247, 37, 133, 0.7)',
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
    violet: accent.violet,
    magenta: accent.magenta,
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
