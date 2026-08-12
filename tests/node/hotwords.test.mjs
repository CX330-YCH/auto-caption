import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseHotwordEntriesText,
  parseHotwordRequest
} from '../../src/shared/hotwords.ts'
import en from '../../src/renderer/src/i18n/lang/en.ts'
import ja from '../../src/renderer/src/i18n/lang/ja.ts'
import zh from '../../src/renderer/src/i18n/lang/zh.ts'

test('parses and validates hotword manager requests', () => {
  assert.deepEqual(
    parseHotwordRequest({
      action: 'create',
      prefix: 'project1',
      vocabulary: [
        { text: 'Auto Caption', weight: 4, lang: 'en' },
        { text: '阿里云百炼', weight: 5, lang: 'zh' }
      ]
    }),
    {
      action: 'create',
      prefix: 'project1',
      vocabulary: [
        { text: 'Auto Caption', weight: 4, lang: 'en' },
        { text: '阿里云百炼', weight: 5, lang: 'zh' }
      ]
    }
  )
  assert.throws(
    () => parseHotwordRequest({
      action: 'delete',
      vocabularyId: '../unsafe'
    }),
    /vocabulary ID/
  )
})

test('parses the manager text format and enforces official entry limits', () => {
  assert.deepEqual(
    parseHotwordEntriesText('Auto Caption | 4 | en\n阿里云百炼 | 5 | zh'),
    [
      { text: 'Auto Caption', weight: 4, lang: 'en' },
      { text: '阿里云百炼', weight: 5, lang: 'zh' }
    ]
  )
  assert.throws(
    () => parseHotwordEntriesText('one two three four five six seven eight | 4 | en'),
    /text length/
  )
  assert.throws(
    () => parseHotwordEntriesText('term | 6 | en'),
    /integer/
  )
})

test('provides the complete hotword manager text in all UI languages', () => {
  const expected = nestedKeys(zh.engine.hotwords)
  assert.deepEqual(nestedKeys(en.engine.hotwords), expected)
  assert.deepEqual(nestedKeys(ja.engine.hotwords), expected)
  for (const messages of [zh, en, ja]) {
    assert.equal(typeof messages.noti.funAsrHotwordModelMismatch, 'string')
    assert.equal(typeof messages.noti.funAsrHotwordModelMismatchNote, 'string')
  }
})

function nestedKeys(value, prefix = '') {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return child && typeof child === 'object'
        ? nestedKeys(child, path)
        : [path]
    })
    .sort()
}
