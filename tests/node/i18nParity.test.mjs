import assert from 'node:assert/strict'
import test from 'node:test'

import en from '../../src/renderer/src/i18n/lang/en.ts'
import ja from '../../src/renderer/src/i18n/lang/ja.ts'
import zh from '../../src/renderer/src/i18n/lang/zh.ts'

test('keeps the complete UI message key structure aligned across languages', () => {
  const expected = nestedKeys(zh)
  assert.deepEqual(nestedKeys(en), expected)
  assert.deepEqual(nestedKeys(ja), expected)
})

function nestedKeys(value, prefix = '') {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return child && typeof child === 'object' ? nestedKeys(child, path) : [path]
    })
    .sort()
}
