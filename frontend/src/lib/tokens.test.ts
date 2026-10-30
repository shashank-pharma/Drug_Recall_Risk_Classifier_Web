import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contrastRatio } from './contrast.ts'
import { CLASS_BADGE, CLASS_COLORS, DARK, LED, PALETTE } from './tokens.ts'

const AA = 4.5 // normal-size text

test('contrastRatio matches known WCAG values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0')
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1)
})

const TEXT_PAIRS: [string, string, string][] = [
  ['body text on the page', PALETTE.text, PALETTE.base],
  ['body text on a card', PALETTE.text, PALETTE.card],
  ['muted text on a card', PALETTE.muted, PALETTE.card],
  ['strong muted text on the page', PALETTE.mutedStrong, PALETTE.base],
  ['strong muted text on a muted chip', PALETTE.mutedStrong, PALETTE.surfaceMuted],
  ['button text on the gradient start', '#FFFFFF', PALETTE.brandFrom],
  ['button text on the gradient end', '#FFFFFF', PALETTE.brandTo],
  ...Object.entries(CLASS_BADGE).map(([cls, c]): [string, string, string] => [`${cls} badge`, c.text, c.bg]),
]

for (const [name, fg, bg] of TEXT_PAIRS) {
  test(`contrast ≥ 4.5:1: ${name}`, () => {
    const ratio = contrastRatio(fg, bg)
    assert.ok(ratio >= AA, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`)
  })
}

test('muted grey now passes on the plain page background too (Phase 13H darker grey)', () => {
  assert.ok(contrastRatio(PALETTE.muted, PALETTE.base) >= AA)
})

test('index.css defines the same colours as tokens.ts', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').toUpperCase()
  const expected = {
    '--background': PALETTE.base,
    '--card': PALETTE.card,
    '--border': PALETTE.border,
    '--foreground': PALETTE.text,
    '--muted-foreground': PALETTE.muted,
    '--muted-foreground-strong': PALETTE.mutedStrong,
    '--muted': PALETTE.surfaceMuted,
    '--brand-from': PALETTE.brandFrom,
    '--brand-to': PALETTE.brandTo,
    '--accent-teal': PALETTE.accent,
    '--class-1': CLASS_COLORS['Class I'],
    '--class-2': CLASS_COLORS['Class II'],
    '--class-3': CLASS_COLORS['Class III'],
    '--led-done': LED.done,
    '--led-pending': LED.pending,
    '--led-overdue': LED.overdue,
  }
  for (const [name, hex] of Object.entries(expected)) {
    assert.ok(css.includes(`${name.toUpperCase()}: ${hex.toUpperCase()};`), `${name} should be ${hex} in index.css`)
  }
})

// --- dark theme -----------------------------------------------------------------------------------

const DARK_PAIRS: [string, string, string][] = [
  ['body text on the page', DARK.text, DARK.base],
  ['body text on a card', DARK.text, DARK.card],
  ['muted text on a card', DARK.muted, DARK.card],
  ['muted text on the page', DARK.muted, DARK.base],
  ['strong muted text on a muted chip', DARK.mutedStrong, DARK.surfaceMuted],
  ['body text on a muted chip', DARK.text, DARK.surfaceMuted],
]

for (const [name, fg, bg] of DARK_PAIRS) {
  test(`dark contrast ≥ 4.5:1: ${name}`, () => {
    const ratio = contrastRatio(fg, bg)
    assert.ok(ratio >= AA, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`)
  })
}

test('the focus ring and class marks stay visible on dark cards (≥ 3:1 for non-text)', () => {
  for (const color of [DARK.ring, ...Object.values(CLASS_COLORS), ...Object.values(LED)]) {
    const ratio = contrastRatio(color, DARK.card)
    assert.ok(ratio >= 3, `${color} on ${DARK.card} is ${ratio.toFixed(2)}:1`)
  }
})

test('the .dark block in index.css matches DARK', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').toUpperCase()
  const start = css.indexOf('.DARK {')
  const block = css.slice(start, css.indexOf('}', start))
  const expected = {
    '--background': DARK.base,
    '--card': DARK.card,
    '--border': DARK.border,
    '--foreground': DARK.text,
    '--muted-foreground': DARK.muted,
    '--muted-foreground-strong': DARK.mutedStrong,
    '--muted': DARK.surfaceMuted,
    '--ring': DARK.ring,
  }
  for (const [name, hex] of Object.entries(expected)) {
    assert.ok(block.includes(`${name.toUpperCase()}: ${hex.toUpperCase()};`), `${name} should be ${hex} in .dark`)
  }
})
