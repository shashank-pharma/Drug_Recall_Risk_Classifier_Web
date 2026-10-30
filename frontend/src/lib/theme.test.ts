import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { otherTheme, readTheme, saveTheme, THEME_KEY } from './theme.ts'

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

test('light by default, dark only when stored', () => {
  assert.equal(readTheme(undefined), 'light')
  assert.equal(readTheme(memoryStore()), 'light')
  assert.equal(readTheme(memoryStore({ [THEME_KEY]: 'neon' })), 'light')
  assert.equal(readTheme(memoryStore({ [THEME_KEY]: 'dark' })), 'dark')
})

test('blocked storage falls back to light and saving reports failure', () => {
  assert.equal(readTheme(blocked), 'light')
  assert.equal(saveTheme(blocked, 'dark'), false)
})

test('saving and toggling', () => {
  const store = memoryStore()
  assert.equal(saveTheme(store, 'dark'), true)
  assert.equal(store.data[THEME_KEY], 'dark')
  assert.equal(otherTheme('dark'), 'light')
  assert.equal(otherTheme('light'), 'dark')
})

test('index.html applies the stored theme before the app loads, with the same key', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const inline = html.indexOf(THEME_KEY)
  assert.ok(inline > 0, 'inline theme script missing')
  assert.ok(inline < html.indexOf('/src/main.tsx'), 'theme script must run before the app')
})
