import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  i18n,
  translate
} from '../../src/renderer/src/i18n/index.ts'

test('translates renderer messages without a Vue component setup context', () => {
  const previousLocale = i18n.global.locale.value

  try {
    i18n.global.locale.value = 'zh'
    assert.equal(translate('noti.error'), '发生错误')

    i18n.global.locale.value = 'en'
    assert.equal(translate('noti.error'), 'An error occurred')
  } finally {
    i18n.global.locale.value = previousLocale
  }
})

test('keeps the engine control store independent of component i18n hooks', async () => {
  const source = await readFile(
    new URL('../../src/renderer/src/stores/engineControl.ts', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(source, /\buseI18n\b/)
  assert.match(source, /\btranslate\b/)
})
