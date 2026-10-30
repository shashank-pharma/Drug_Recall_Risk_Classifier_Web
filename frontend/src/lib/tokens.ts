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

// --- Ambient background (Phase 13E, stronger in 13F) ----------------------------------------------
// Pastels live only on the page background and surfaces; text and class colours never change.
// Mirrored by the --mesh-*, --zone-*, --tint-class-* and --surface-* variables in index.css (background.test.ts).

/** Base mesh: the pastel gradient across the whole page, plus the floating blobs. */
export const MESH = {
  light: { lavender: '#E4DCFF', sky: '#D6E8FF', mint: '#D5F3E6', peach: '#FFE3CF' },
  dark: { lavender: '#1C1E4A', sky: '#112443', mint: '#0F2A31', peach: '#2A1F36' },
} as const

/** Tints per area of the app (two corners each), cross-faded on route change; also what plain cards are tinted with. */
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

/** Cards are white with this share of a pastel mixed in (25–35%). */
export const CARD_TINT = 0.32

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
