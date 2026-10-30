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
