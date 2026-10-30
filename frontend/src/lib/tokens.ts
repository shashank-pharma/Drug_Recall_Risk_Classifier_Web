// Design tokens for code that needs real colour values (charts, SVG). The CSS variables in
// src/index.css hold the same values; tokens.test.ts fails if the two drift apart.

export const PALETTE = {
  base: '#F6F8FB',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  /** muted text on the page background or on muted chips, where #64748B is below 4.5:1 */
  mutedStrong: '#475569',
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

// --- Ambient background (Phase 13E) ---------------------------------------------------------------
// Pastels live only on the page background and surfaces; text and class colours never change.
// Mirrored by the --mesh-*, --zone-* and --tint-class-* variables in index.css (tokens.test.ts).

/** Base mesh: the soft gradient behind every page, plus the slow floating blobs. */
export const MESH = {
  light: { lavender: '#F3F0FF', sky: '#EAF4FF', mint: '#E8F8F3', peach: '#FFF1E6' },
  dark: { lavender: '#171A3D', sky: '#0F1F38', mint: '#0D2229', peach: '#211A2E' },
} as const

/** Tints per area of the app (two corners each), cross-faded on route change. `accent` is the thin line on top of cards. */
export const ZONES = {
  light: {
    new: { tint: '#ECE6FF', tint2: '#F3F0FF', accent: '#A78BFA' },
    history: { tint: '#E1EEFF', tint2: '#EEF6FF', accent: '#60A5FA' },
    explorer: { tint: '#DFF5EE', tint2: '#ECFAF5', accent: '#2DD4BF' },
    // peach-lavender: peach in one corner, lavender in the other (not rose, which is Class I's tint)
    dashboard: { tint: '#FFEDDF', tint2: '#EEE8FF', accent: '#FDBA74' },
  },
  dark: {
    new: { tint: '#1B1B47', tint2: '#151938', accent: '#8B7CF6' },
    history: { tint: '#0F2342', tint2: '#0E1C35', accent: '#3B82F6' },
    explorer: { tint: '#0D2830', tint2: '#0D1F29', accent: '#14B8A6' },
    dashboard: { tint: '#261D2B', tint2: '#1A1B40', accent: '#FB923C' },
  },
} as const

/** Background-only tint while one class is chosen. Badges and chart marks keep CLASS_COLORS. */
export const CLASS_TINTS = {
  light: { 'Class I': '#FDECEC', 'Class II': '#FEF5E1', 'Class III': '#E6F3FB' },
  dark: { 'Class I': '#2A1520', 'Class II': '#292214', 'Class III': '#0E2236' },
} as const

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

/** Share of the zone accent mixed into chart cards (6–8%). */
export const CHART_TINT = 0.07
