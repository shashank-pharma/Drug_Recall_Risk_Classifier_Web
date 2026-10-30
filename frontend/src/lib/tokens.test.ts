import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contrastRatio } from './contrast.ts'
import { CLASS_BADGE, CLASS_COLORS, LED, PALETTE } from './tokens.ts'

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

test('plain muted grey stays off the page background (below 4.5:1 there)', () => {
  // Documents why mutedStrong exists: use text-muted-strong for text on the page or on muted chips.
  assert.ok(contrastRatio(PALETTE.muted, PALETTE.base) < AA)
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
