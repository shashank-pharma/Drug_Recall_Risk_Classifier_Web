import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contrastRatio } from './contrast.ts'
import { CARD_TINT, CLASS_BADGE, CLASS_COLORS, CLASS_TINTS, DARK, MARK_EDGE, MESH, PALETTE, SURFACE_TINTS, ZONES } from './tokens.ts'
import { classTintFor, zoneFor } from './zone.ts'

const AA = 4.5
const UI = 3

/** Mix two hex colours (like CSS color-mix in sRGB). */
function mix(a: string, b: string, shareOfB: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) => Math.round(ch(a, i) * (1 - shareOfB) + ch(b, i) * shareOfB).toString(16).padStart(2, '0'))
    .join('')}`
}

// Every colour the page background can show; gradients blend between these and the plain page colour.
const lightBackgrounds = [
  PALETTE.base,
  ...Object.values(MESH.light),
  ...Object.values(ZONES.light).flatMap((z) => [z.tint, z.tint2]),
  ...Object.values(CLASS_TINTS.light),
]
const darkBackgrounds = [
  DARK.base,
  ...Object.values(MESH.dark),
  ...Object.values(ZONES.dark).flatMap((z) => [z.tint, z.tint2]),
  ...Object.values(CLASS_TINTS.dark),
]
// Cards: white (navy in dark) with CARD_TINT of a zone tint or a KPI tint mixed in.
const lightCards = [
  ...Object.values(ZONES.light).flatMap((z) => [z.tint, z.tint2]),
  ...Object.values(SURFACE_TINTS.light),
].map((t) => mix(PALETTE.card, t, CARD_TINT))
const darkCards = [
  ...Object.values(ZONES.dark).flatMap((z) => [z.tint, z.tint2]),
  ...Object.values(SURFACE_TINTS.dark),
].map((t) => mix(DARK.card, t, CARD_TINT))

function atLeast(fg: string, bgs: string[], min: number, what: string) {
  for (const bg of bgs) {
    const r = contrastRatio(fg, bg)
    assert.ok(r >= min, `${what}: ${fg} on ${bg} is ${r.toFixed(2)}:1 (needs ${min}:1)`)
  }
}

test('page text on every light background tint', () => {
  atLeast(PALETTE.text, lightBackgrounds, AA, 'body text')
  atLeast(PALETTE.mutedStrong, lightBackgrounds, AA, 'muted text on the page (text-muted-strong)')
})

test('plain muted grey is not enough on the tints, which is why page text uses text-muted-strong', () => {
  assert.ok(lightBackgrounds.some((bg) => contrastRatio(PALETTE.muted, bg) < AA))
})

test('page text on every dark background tint', () => {
  atLeast(DARK.text, darkBackgrounds, AA, 'body text')
  atLeast(DARK.muted, darkBackgrounds, AA, 'muted text')
  atLeast(DARK.mutedStrong, darkBackgrounds, AA, 'strong muted text')
})

test('tinted cards switch muted text to the strong grey, which passes on every tint', () => {
  atLeast(PALETTE.text, lightCards, AA, 'body text on cards')
  atLeast(PALETTE.mutedStrong, lightCards, AA, 'muted text on cards')
  atLeast('#B91C1C', lightCards, AA, 'red-700 alert text on cards')
  atLeast(DARK.text, darkCards, AA, 'dark body text on cards')
  atLeast(DARK.mutedStrong, darkCards, AA, 'dark muted text on cards')
  // Plain muted grey would fall short on some tints; this is why cards swap it.
  assert.ok(lightCards.some((bg) => contrastRatio(PALETTE.muted, bg) < AA))
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-slot="card"\][^{]*\{[^}]*--muted-foreground:\s*var\(--muted-foreground-strong\)/)
})

test('class badges keep their own contrast whatever is behind them', () => {
  for (const [cls, c] of Object.entries(CLASS_BADGE)) atLeast(c.text, [c.bg], AA, `${cls} badge`)
})

test('small class and status marks reach 3:1 through their edge on every surface', () => {
  const surfaces = [...lightBackgrounds, ...lightCards]
  for (const [name, edge] of Object.entries(MARK_EDGE)) atLeast(edge, surfaces, UI, `${name} mark edge`)
})

test('class colours are not reused as pastel background colours', () => {
  const pastels = [...lightBackgrounds, ...darkBackgrounds, ...Object.values(SURFACE_TINTS.light)]
  for (const c of Object.values(CLASS_COLORS)) assert.ok(!pastels.includes(c), `${c} is a class colour`)
})

test('index.css defines the background tokens (light in :root, dark in .dark)', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').toUpperCase()
  const dark = css.slice(css.indexOf('.DARK {'), css.indexOf('}', css.indexOf('.DARK {')))
  const has = (block: string, name: string, hex: string) =>
    assert.ok(block.includes(`${name.toUpperCase()}: ${hex.toUpperCase()};`), `${name} should be ${hex}`)
  for (const theme of ['light', 'dark'] as const) {
    const block = theme === 'dark' ? dark : css
    for (const [k, v] of Object.entries(MESH[theme])) has(block, `--mesh-${k}`, v)
    for (const [k, z] of Object.entries(ZONES[theme])) {
      has(block, `--zone-${k}`, z.tint)
      has(block, `--zone-${k}-2`, z.tint2)
    }
    for (const [k, v] of Object.entries(SURFACE_TINTS[theme])) has(block, `--surface-${k}`, v)
    Object.values(CLASS_TINTS[theme]).forEach((v, i) => has(block, `--tint-class-${i + 1}`, v))
  }
})

// --- zones ----------------------------------------------------------------------------------------

test('each route has its zone; a recall page belongs to History', () => {
  assert.equal(zoneFor('/'), 'new')
  assert.equal(zoneFor('/history'), 'history')
  assert.equal(zoneFor('/recalls/12'), 'history')
  assert.equal(zoneFor('/explorer'), 'explorer')
  assert.equal(zoneFor('/dashboard'), 'dashboard')
  assert.equal(zoneFor('/nope'), 'new')
})

test('class tint only for exactly one known class on Dashboard or History', () => {
  const q = (s: string) => new URLSearchParams(s)
  assert.equal(classTintFor('/dashboard', q('class=Class+I')), 'Class I')
  assert.equal(classTintFor('/history', q('class=Class+III')), 'Class III')
  assert.equal(classTintFor('/history', q('class=Class+I&class=Class+II')), null)
  assert.equal(classTintFor('/dashboard', q('')), null)
  assert.equal(classTintFor('/dashboard', q('class=Class+IV')), null)
  assert.equal(classTintFor('/explorer', q('class=Class+I')), null)
  assert.equal(classTintFor('/recalls/3', q('class=Class+I')), null)
})
