import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contrastRatio } from './contrast.ts'
import { CLASS_BADGE, CLASS_COLORS, CLASS_TINTS, DARK, FROST, KPI_TINT, MARK_EDGE, PALETTE, PALETTES, SURFACE_TINTS, ZONES } from './tokens.ts'
import { classTintFor, zoneFor } from './zone.ts'

const AA = 4.5
const UI = 3
const ERROR_TEXT = '#B91C1C' // --destructive in light (red-700)

/** Mix two hex colours (like CSS color-mix in sRGB). */
function mix(a: string, b: string, shareOfB: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) => Math.round(ch(a, i) * (1 - shareOfB) + ch(b, i) * shareOfB).toString(16).padStart(2, '0'))
    .join('')}`
}

function atLeast(fg: string, bgs: readonly string[], min: number, what: string) {
  for (const bg of bgs) {
    const r = contrastRatio(fg, bg)
    assert.ok(r >= min, `${what}: ${fg} on ${bg} is ${r.toFixed(2)}:1 (needs ${min}:1)`)
  }
}

// Every colour text can sit on directly: the gradient stops and the aurora blobs (darkest in light,
// lightest in dark). Frosted surfaces are white (navy) at FROST over those; KPI cards mix in their tint.
for (const [name, p] of Object.entries(PALETTES)) {
  const page = [...p.light.stops, ...p.light.blobs]
  const frosted = page.map((c) => mix(c, '#FFFFFF', FROST))
  const kpi = frosted.flatMap((c) => Object.values(SURFACE_TINTS.light).map((t) => mix(c, t, KPI_TINT)))
  const darkPage = [...p.dark.stops, ...p.dark.blobs]
  const darkFrosted = darkPage.map((c) => mix(c, DARK.card, FROST))

  test(`${name}: text on the page background`, () => {
    atLeast(PALETTE.text, page, AA, 'body text')
    atLeast(PALETTE.muted, page, AA, 'muted text')
    atLeast(PALETTE.mutedStrong, page, AA, 'strong muted text')
    atLeast(p.light.accent, page, UI, 'focus ring')
  })

  test(`${name}: text on frosted and KPI cards`, () => {
    for (const surfaces of [frosted, kpi]) {
      atLeast(PALETTE.text, surfaces, AA, 'body text')
      atLeast(PALETTE.muted, surfaces, AA, 'muted text')
      atLeast(ERROR_TEXT, surfaces, AA, 'error and overdue text')
    }
    atLeast(p.light.accent, frosted, UI, 'focus ring on cards')
  })

  test(`${name}: small class and status marks reach 3:1 on cards`, () => {
    for (const [mark, edge] of Object.entries(MARK_EDGE)) atLeast(edge, frosted, UI, `${mark} mark edge`)
  })

  test(`${name}: dark theme text and focus ring`, () => {
    atLeast(DARK.text, [...darkPage, ...darkFrosted], AA, 'dark body text')
    atLeast(DARK.muted, [...darkPage, ...darkFrosted], AA, 'dark muted text')
    atLeast(p.dark.accent, [...darkPage, ...darkFrosted], UI, 'dark focus ring')
  })
}

test('class badges keep their own text contrast on any background', () => {
  for (const [cls, c] of Object.entries(CLASS_BADGE)) atLeast(c.text, [c.bg], AA, `${cls} badge`)
})

test('class colours are not reused as background or accent colours', () => {
  const used = Object.values(PALETTES).flatMap((p) => [
    ...p.light.stops, ...p.light.blobs, p.light.accent, ...p.dark.stops, ...p.dark.blobs, p.dark.accent,
  ])
  for (const c of Object.values(CLASS_COLORS)) assert.ok(!used.includes(c), `${c} is a class colour`)
})

test('index.css defines every palette (light and dark), page shifts and class tints', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').toUpperCase()
  const block = (selector: string) => {
    const start = css.indexOf(`${selector.toUpperCase()} {`)
    assert.ok(start >= 0, `${selector} block missing`)
    return css.slice(start, css.indexOf('}', start))
  }
  const has = (b: string, name: string, hex: string) =>
    assert.ok(b.includes(`${name.toUpperCase()}: ${hex.toUpperCase()};`), `${name} should be ${hex}`)
  for (const [name, p] of Object.entries(PALETTES)) {
    for (const theme of ['light', 'dark'] as const) {
      const selector =
        theme === 'light'
          ? name === 'lagoon' ? ':root[data-palette]' : `:root[data-palette="${name}"]`
          : name === 'lagoon' ? '.dark[data-palette]' : `.dark[data-palette="${name}"]`
      const b = block(selector)
      p[theme].stops.forEach((c, i) => has(b, `--bg-${i + 1}`, c))
      p[theme].blobs.forEach((c, i) => has(b, `--blob-${i + 1}`, c))
      has(b, '--accent-ring', p[theme].accent)
    }
  }
  const dark = block('.dark')
  for (const theme of ['light', 'dark'] as const) {
    const b = theme === 'dark' ? dark : css
    for (const [k, z] of Object.entries(ZONES[theme])) {
      has(b, `--zone-${k}`, z.tint)
      has(b, `--zone-${k}-2`, z.tint2)
    }
    Object.values(CLASS_TINTS[theme]).forEach((v, i) => has(b, `--tint-class-${i + 1}`, v))
    for (const [k, v] of Object.entries(SURFACE_TINTS[theme])) has(b, `--surface-${k}`, v)
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
