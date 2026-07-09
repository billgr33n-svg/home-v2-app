// Design tokens. One source of truth, so a change to spacing or colour happens
// once rather than in fourteen StyleSheets.
//
// Sizing is driven by one hard constraint: a touch target must be at least 44pt
// (Apple HIG) / 48dp (Material). Everything else — chip padding, row height,
// tab width — is derived from that, not chosen by eye.

export const color = {
  // Backgrounds, darkest to lightest.
  bg: '#0B0E1A',
  surface: '#141827',
  surfaceRaised: '#1B2033',
  surfaceInput: '#1F2438',

  border: '#2A3048',
  borderStrong: '#3A4160',

  // Text
  text: '#F2F4FA',
  textMuted: '#A2A8C3',
  textFaint: '#6C7391',

  // Brand + semantics
  accent: '#7C9BFF',
  accentInk: '#0B0E1A',
  accentSoft: '#1E2440',

  success: '#7BD99A',
  warning: '#F3B563',
  danger: '#F08A8A',
  dangerSoft: '#D99AC0',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Minimum comfortable touch target. Nothing interactive goes below this. */
export const TOUCH = 44;

export const type = {
  title: { fontSize: 24, fontWeight: '700' as const, color: color.text },
  heading: { fontSize: 17, fontWeight: '600' as const, color: color.text },
  body: { fontSize: 15, color: color.text },
  detail: { fontSize: 13, color: color.textMuted },
  meta: { fontSize: 11, color: color.textFaint },
  section: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.3,
    color: color.textFaint,
  },
  kicker: { fontSize: 11, letterSpacing: 1.8, color: color.textFaint },
} as const;

/**
 * The app is a phone app that happens to run in a browser. On a wide screen,
 * a 1400px-wide list of chips is unreadable, so the content column is capped
 * and centred rather than stretched.
 */
export const CONTENT_MAX_WIDTH = 720;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

/** A chip that is always tappable: 44pt tall regardless of font metrics. */
export const chipBase = {
  minHeight: TOUCH,
  justifyContent: 'center' as const,
  paddingHorizontal: space.lg,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: color.borderStrong,
};

export const inputBase = {
  minHeight: TOUCH + 4,
  backgroundColor: color.surfaceInput,
  color: color.text,
  borderRadius: radius.md,
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
  fontSize: 16, // 16px prevents iOS Safari from zooming on focus.
  borderWidth: 1,
  borderColor: color.border,
};

export const buttonBase = {
  minHeight: TOUCH + 4,
  borderRadius: radius.md,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingHorizontal: space.xl,
};
