import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MOTION_KEY, readMotionSetting, resolveMotion, saveMotionSetting } from './motionPref.ts'
import { DEFAULT_PALETTE, PALETTE_KEY, PALETTE_NAMES, readPalette, savePalette, stepPalette } from './palette.ts'

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data }
}
const blocked = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

// --- palette --------------------------------------------------------------------------------------

test('three palettes, Lagoon by default', () => {
  assert.deepEqual(PALETTE_NAMES, ['lagoon', 'lavender', 'sage'])
  assert.equal(DEFAULT_PALETTE, 'lagoon')
  assert.equal(readPalette(undefined), 'lagoon')
  assert.equal(readPalette(memoryStore()), 'lagoon')
  assert.equal(readPalette(memoryStore({ [PALETTE_KEY]: 'neon' })), 'lagoon')
})

test('the chosen palette is remembered and read back', () => {
  const store = memoryStore()
  assert.equal(savePalette(store, 'sage'), true)
  assert.equal(store.data[PALETTE_KEY], 'sage')
  assert.equal(readPalette(store), 'sage')
})

test('blocked storage falls back to Lagoon and saving reports failure', () => {
  assert.equal(readPalette(blocked), 'lagoon')
  assert.equal(savePalette(blocked, 'lavender'), false)
})

test('arrow keys step through the palettes and wrap', () => {
  assert.equal(stepPalette('lagoon', 1), 'lavender')
  assert.equal(stepPalette('sage', 1), 'lagoon')
  assert.equal(stepPalette('lagoon', -1), 'sage')
})

// --- motion ---------------------------------------------------------------------------------------

test('Auto follows the OS setting; Full and Reduced override it', () => {
  assert.equal(resolveMotion('auto', false), 'full')
  assert.equal(resolveMotion('auto', true), 'reduced')
  assert.equal(resolveMotion('full', true), 'full')
  assert.equal(resolveMotion('reduced', false), 'reduced')
})

test('the motion setting is remembered; unknown or blocked means Auto', () => {
  const store = memoryStore()
  assert.equal(readMotionSetting(store), 'auto')
  assert.equal(saveMotionSetting(store, 'full'), true)
  assert.equal(readMotionSetting(store), 'full')
  assert.equal(readMotionSetting(memoryStore({ [MOTION_KEY]: 'fast' })), 'auto')
  assert.equal(readMotionSetting(blocked), 'auto')
  assert.equal(saveMotionSetting(blocked, 'reduced'), false)
})

test('index.html applies the stored palette and motion before the app loads', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const app = html.indexOf('/src/main.tsx')
  for (const key of [PALETTE_KEY, MOTION_KEY]) {
    const at = html.indexOf(key)
    assert.ok(at > 0 && at < app, `${key} must be read before the app script`)
  }
  assert.match(html, /dataset\.motion/)
  assert.match(html, /dataset\.palette/)
})

test('index.css switches motion off with data-motion="reduced", not only the OS query', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-motion="reduced"\]/)
  assert.doesNotMatch(css, /@media \(prefers-reduced-motion/)
})
