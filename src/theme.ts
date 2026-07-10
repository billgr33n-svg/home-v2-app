// Design tokens. One source of truth, so a change to spacing or colour happens
// once rather than in fifteen StyleSheets.
//
// PALETTE: warm domestic light (2026-07-10, replaces the dark indigo).
//
// The old theme read as a developer dashboard: near-black indigo, cool blue
// accent, high-contrast neon semantics. This is a tool a family opens in a
// kitchen, so the surface is warm bone rather than white, the ink is a warm
// near-black rather than pure black, and the accent is terracotta.
//
// Every colour below clears WCAG AA (4.5:1) against the surface it is used on.
// That is not decoration: `meta` text is 11px, and 11px grey-on-grey is the
// single most common way a UI becomes unusable in daylight. If you change a
// value here, re-check the contrast before you commit it.
//
// Sizing is driven by one hard constraint: a touch target must be at least 44pt
// (Apple HIG) / 48dp (Material). Everything else -- chip padding, row height,
// tab width -- is derived from that, not chosen by eye.

export const color = {
  // Backgrounds, lightest to most raised.
  bg: '#FBF8F4', // warm bone, not white: white sheets glare
  surface: '#FFFFFF',
  surfaceRaised: '#F4EEE6',
  surfaceInput: '#FFFFFF',

  border: '#E6DFD4',
  borderStrong: '#CBC1B2',

  // Text. Warm near-black, never #000.
  text: '#241F1B',
  textMuted: '#5E564E',
  textFaint: '#776C62', // 4.7:1 on bg -- do not lighten

  // Brand + semantics
  accent: '#A34A25', // terracotta
  accentInk: '#FFFFFF', // text on accent: 5.4:1
  accentSoft: '#F7E8DF',

  success: '#3F6B4F',
  successSoft: '#E4EFE5',

  warning: '#8A5A11',
  warningSoft: '#FAEDD6',

  danger: '#A33329',
  dangerSoft: '#F7E2DF',
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
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.5, color: color.text },
  title: { fontSize: 25, fontWeight: '700' as const, letterSpacing: -0.3, color: color.text },
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
  kicker: { fontSize: 11, letterSpacing: 1.8, fontWeight: '600' as const, color: color.textFaint },
} as const;

/**
 * The app is a phone app that happens to run in a browser. On a wide screen,
 * a 1400px-wide list of chips is unreadable, so the content column is capped
 * and centred rather than stretched.
 */
export const CONTENT_MAX_WIDTH = 720;

/**
 * On a light surface a heavy drop shadow looks like dirt. Cards get a hairline
 * border for definition and a whisper of shadow for lift -- not the reverse.
 */
export const shadow = {
  card: {
    shadowColor: '#3A2C1E',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#3A2C1E',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;

/** A card. Border first, shadow second (see `shadow`). */
export const cardBase = {
  backgroundColor: color.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: color.border,
  padding: space.lg,
  ...shadow.card,
};

/** A chip that is always tappable: 44pt tall regardless of font metrics. */
export const chipBase = {
  minHeight: TOUCH,
  justifyContent: 'center' as const,
  paddingHorizontal: space.lg,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: color.borderStrong,
  backgroundColor: color.surface,
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
  borderColor: color.borderStrong,
};

export const buttonBase = {
  minHeight: TOUCH + 4,
  borderRadius: radius.md,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingHorizontal: space.xl,
};
