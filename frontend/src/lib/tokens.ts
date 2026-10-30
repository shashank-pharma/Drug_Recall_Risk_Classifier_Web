// Design tokens for code that needs real colour values (charts, SVG). The CSS variables in
// src/index.css hold the same values; tokens.test.ts fails if the two drift apart.

export const PALETTE = {
  base: '#F6F8FB',
  card: '#FFFFFF',
  border: '#E2E8F0',
  // Phase 13H: deeper navy text and a darker muted grey, readable on mid-tone pastels.
  text: '#1B2440',
  muted: '#3B4663',
  /** muted text on the page background or on muted chips, where #64748B is below 4.5:1 */
  mutedStrong: '#2E3852',
  surfaceMuted: '#F1F5F9',
  brandFrom: '#4F46E5',
  brandTo: '#7C3AED',
  accent: '#0D9488',
} as const

/** Dark theme surfaces and text (the `.dark` block in index.css). Brand, class and LED colours stay the same. */
export const DARK = {
  base: '#0B1324',
  card: '#111B2E',
  border: '#24324D',
  text: '#E2E8F0',
  muted: '#94A3B8',
  mutedStrong: '#B4C0D3',
  surfaceMuted: '#1A2740',
  ring: '#818CF8',
} as const

/** Risk colours: only for recall classes, never for neutral data series. */
export const CLASS_COLORS = {
  'Class I': '#DC2626',
  'Class II': '#F59E0B',
  'Class III': '#0284C7',
} as const

/** Milestone status lights; always shown with a text label. */
export const LED = {
  done: '#16A34A',
  pending: '#F59E0B',
  overdue: '#DC2626',
} as const

/**
 * Badge background and text per class. Class III badges use a darker sky (#0369A1) because white
 * text on #0284C7 is only 4.1:1; charts and other marks keep #0284C7.
 */
export const CLASS_BADGE = {
  'Class I': { bg: '#DC2626', text: '#FFFFFF' },
  'Class II': { bg: '#F59E0B', text: '#451A03' },
  'Class III': { bg: '#0369A1', text: '#FFFFFF' },
} as const

/** Tints for neutral data (never red/amber/sky): light → strong. */
export const TINTS = {
  indigo: ['#EEF2FF', '#E0E7FF', '#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1', '#4F46E5'],
  violet: ['#F5F3FF', '#EDE9FE', '#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED'],
  teal: ['#F0FDFA', '#CCFBF1', '#99F6E4', '#5EEAD4', '#2DD4BF', '#14B8A6', '#0D9488'],
} as const

// --- Ambient background (Phase 13E, stronger in 13F) ----------------------------------------------
// Pastels live only on the page background and surfaces; text and class colours never change.
// Mirrored by the --mesh-*, --zone-*, --tint-class-* and --surface-* variables in index.css (background.test.ts).

/**
 * Calm background palettes (Phase 13H). `stops` are the page gradient, `blobs` the four aurora colours
 * (the darkest colours text ever sits on), `accent` the focus ring and `link` the Explorer's thin tree lines
 * (--border-strong). Mirrored by --bg-*, --blob-* and
 * --accent-ring in index.css; the choice is stored by lib/palette.ts.
 */
export const PALETTES = {
  lagoon: {
    label: 'Lagoon',
    light: { stops: ['#BFD9F2', '#C9E4E0', '#D5D2F0'], blobs: ['#A9CDF0', '#B2DDD5', '#C4BFF0', '#CFE6F8'], accent: '#0F766E', link: '#5E7A99' },
    dark: { stops: ['#0E2036', '#0F282C', '#1B1A3A'], blobs: ['#16355A', '#123634', '#2A2560', '#13304D'], accent: '#2DD4BF', link: '#7E9BBF' },
  },
  lavender: {
    label: 'Lavender Dusk',
    light: { stops: ['#D8CCF5', '#E6D3F0', '#CFD8F5'], blobs: ['#C8B8F2', '#DCC3EC', '#BFCBF2', '#E2D6F7'], accent: '#6D28D9', link: '#76689C' },
    dark: { stops: ['#1E1838', '#251A36', '#18203E'], blobs: ['#2E2560', '#3A2552', '#24305E', '#2B2148'], accent: '#A78BFA', link: '#9C8FC6' },
  },
  sage: {
    label: 'Sage Calm',
    light: { stops: ['#CFE5D6', '#D7E8E2', '#DCE3F3'], blobs: ['#BEDBC8', '#C9E0D7', '#CCD6F0', '#DCEBDF'], accent: '#2F6F55', link: '#5D7C6C' },
    dark: { stops: ['#10241B', '#13261F', '#161E33'], blobs: ['#1C3A2A', '#1F3A31', '#22304F', '#1A3326'], accent: '#6EE7B7', link: '#86A898' },
  },
} as const
export type PaletteName = keyof typeof PALETTES

/** Frosted surfaces (nav, main cards, detail panel, dialogs): white (navy in dark) at this opacity, blurred. */
export const FROST = 0.55

/** Small per-page shift laid over the palette (translucent), cross-faded on route change. */
export const ZONES = {
  light: {
    new: { tint: '#D9CFFF', tint2: '#E4DCFF' },
    history: { tint: '#CCE0FF', tint2: '#D6E8FF' },
    explorer: { tint: '#C9EEDD', tint2: '#D5F3E6' },
    // peach-lavender: peach in one corner, lavender in the other (not rose, which is Class I's tint)
    dashboard: { tint: '#FFD9C0', tint2: '#DDD3FF' },
  },
  dark: {
    new: { tint: '#211F55', tint2: '#1C1E4A' },
    history: { tint: '#11284D', tint2: '#112443' },
    explorer: { tint: '#0F2F36', tint2: '#0F2A31' },
    dashboard: { tint: '#2E2234', tint2: '#1E1F4D' },
  },
} as const

/** Background-only tint while one class is chosen. Badges and chart marks keep CLASS_COLORS. */
export const CLASS_TINTS = {
  light: { 'Class I': '#FAD6D6', 'Class II': '#FCE8C0', 'Class III': '#D0E8F8' },
  dark: { 'Class I': '#33182A', 'Class II': '#302816', 'Class III': '#10263D' },
} as const

/** KPI card tints (Dashboard): Total = lavender, Units = sky, Class I = rose (risk), Overdue = mint. */
export const SURFACE_TINTS = {
  light: { lavender: '#E4DCFF', sky: '#D6E8FF', rose: '#FAD6D6', mint: '#D5F3E6' },
  dark: { lavender: '#2A2A66', sky: '#163259', rose: '#4A1E30', mint: '#14403F' },
} as const

/** KPI cards mix this share of their tint into the frosted surface. */
export const KPI_TINT = 0.35

/**
 * Darker edge around small class and status marks (dots, lights). Amber #F59E0B is only ~2:1 on white
 * and on the pastels, so marks get this outline to reach 3:1; badge text keeps CLASS_BADGE.
 */
export const MARK_EDGE = {
  'Class I': '#991B1B',
  'Class II': '#B45309',
  'Class III': '#075985',
  done: '#166534',
  pending: '#B45309',
  overdue: '#991B1B',
} as const
