import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appleSpeechLocalesEqual,
  getAppleSpeechReadiness,
  normalizeAppleSpeechLocale
} from '../../src/shared/appleSpeech.ts'
import { appleSpeechLocaleDisplayName } from '../../src/renderer/src/engines/appleSpeechLocale.ts'

function modelStatus(state, systemInstalled = false) {
  return {
    locale: 'zh-CN',
    state,
    systemInstalled,
    reservedLocales: [],
    maximumReservedLocales: 5
  }
}

test('normalizes Apple locale separators and canonical casing', () => {
  assert.equal(normalizeAppleSpeechLocale('zh_CN'), 'zh-CN')
  assert.equal(normalizeAppleSpeechLocale('ZH_cn'), 'zh-CN')
  assert.equal(normalizeAppleSpeechLocale('yue_CN'), 'yue-CN')
  assert.equal(appleSpeechLocalesEqual('zh_CN', 'zh-CN'), true)
  assert.equal(appleSpeechLocalesEqual('zh_TW', 'zh-CN'), false)
})

test('distinguishes download, activation, preparation, and readiness', () => {
  assert.equal(getAppleSpeechReadiness(modelStatus('supported', false)), 'needs_download')
  assert.equal(getAppleSpeechReadiness(modelStatus('supported', true)), 'needs_activation')
  assert.equal(getAppleSpeechReadiness(modelStatus('downloading', true)), 'preparing')
  assert.equal(getAppleSpeechReadiness(modelStatus('installed', true)), 'ready')
  assert.equal(getAppleSpeechReadiness(modelStatus('unsupported')), 'unsupported')
})

test('uses localized names for Chinese Apple Speech locales', () => {
  const messages = {
    'engine.appleSpeech.localeNames.zhCN': '简体中文（中国大陆）',
    'engine.appleSpeech.localeNames.zhTW': '繁体中文（台湾）'
  }
  const translate = (key) => messages[key] ?? key

  assert.equal(
    appleSpeechLocaleDisplayName('zh_CN', 'zh', translate),
    '简体中文（中国大陆）'
  )
  assert.equal(
    appleSpeechLocaleDisplayName('zh-TW', 'zh', translate),
    '繁体中文（台湾）'
  )
  assert.notEqual(appleSpeechLocaleDisplayName('en_US', 'zh', translate), 'en-US')
})
