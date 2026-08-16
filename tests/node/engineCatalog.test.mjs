import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'

import { createDefaultConfig } from '../../src/shared/config/schema.ts'
import {
  applyEngineLanguageDefaults,
  engineDefinitions,
  getEngineDefinition,
  getEngineFields,
  normalizeEngineConfig,
  validateEngineConfig
} from '../../src/renderer/src/engines/catalog.ts'
import {
  cloneEngineConfig,
  getEngineConfigValue,
  isEngineFieldVisible,
  setEngineConfigValue
} from '../../src/renderer/src/engines/form.ts'
import en from '../../src/renderer/src/i18n/lang/en.ts'
import ja from '../../src/renderer/src/i18n/lang/ja.ts'
import zh from '../../src/renderer/src/i18n/lang/zh.ts'

function hasMessageKey(messages, key) {
  return key.split('.').reduce((current, segment) => current?.[segment], messages) !== undefined
}

test('registers each V5 provider once with capability and field metadata', () => {
  const providerIds = engineDefinitions.map((definition) => definition.id)

  assert.deepEqual(providerIds, ['gummy', 'vosk', 'sosv', 'glm', 'fun_asr'])
  assert.equal(new Set(providerIds).size, providerIds.length)

  for (const provider of providerIds) {
    const definition = getEngineDefinition(provider)
    const fields = getEngineFields(provider)
    const fieldIds = fields.map((field) => field.id)

    assert.ok(definition.languages.some((language) => language.roles.includes('source')))
    assert.ok(definition.languages.some((language) => language.roles.includes('target')))
    assert.equal(new Set(fieldIds).size, fieldIds.length)
    assert.ok(fields.some((field) => field.path === 'common.audioSource'))
  }
})

test('uses translation capability to include only relevant generic fields', () => {
  const gummyFields = getEngineFields('gummy')
  const voskFields = getEngineFields('vosk')

  assert.equal(
    gummyFields.some((field) => field.path === 'common.translation.provider'),
    false
  )
  assert.equal(
    voskFields.some((field) => field.path === 'common.translation.provider'),
    true
  )
})

test('reads, writes, clones, and evaluates nested form fields without provider branches', () => {
  const config = createDefaultConfig('/recordings').engine
  const clone = cloneEngineConfig(config)
  const modelField = getEngineFields('vosk').find((field) => field.id === 'translation-model')

  assert.ok(modelField)
  assert.equal(getEngineConfigValue(clone, 'common.translation.model'), 'qwen2.5:0.5b')
  setEngineConfigValue(clone, 'common.translation.model', 'qwen3:0.6b')
  assert.equal(clone.common.translation.model, 'qwen3:0.6b')
  assert.equal(config.common.translation.model, 'qwen2.5:0.5b')
  assert.equal(isEngineFieldVisible(clone, modelField), true)

  clone.common.translation.enabled = false
  assert.equal(isEngineFieldVisible(clone, modelField), false)
  clone.common.translation.enabled = true

  clone.common.translation.provider = 'google'
  assert.equal(isEngineFieldVisible(clone, modelField), false)
})

test('clones Vue reactive engine config without retaining proxy state', () => {
  const config = reactive(createDefaultConfig('/recordings').engine)
  const clone = cloneEngineConfig(config)

  assert.deepEqual(clone, createDefaultConfig('/recordings').engine)
  clone.common.translation.model = 'qwen3:0.6b'
  assert.equal(config.common.translation.model, 'qwen2.5:0.5b')
})

test('validates start requirements from the selected provider definition', () => {
  const config = createDefaultConfig('/recordings').engine

  config.activeEngineId = 'vosk'
  assert.equal(validateEngineConfig(config, 'start')?.fieldId, 'vosk-model-path')
  config.providers.vosk.modelPath = '/models/vosk'
  assert.equal(validateEngineConfig(config, 'start'), null)

  config.activeEngineId = 'sosv'
  assert.equal(validateEngineConfig(config, 'start')?.fieldId, 'sosv-model-path')
  config.providers.sosv.modelPath = '/models/sosv'
  assert.equal(validateEngineConfig(config, 'start'), null)

  config.activeEngineId = 'glm'
  assert.equal(validateEngineConfig(config, 'start'), null)
})

test('validates external translation and normalizes provider defaults from metadata', () => {
  const config = createDefaultConfig('/recordings').engine
  config.activeEngineId = 'glm'
  config.common.translation.model = '  '

  assert.equal(validateEngineConfig(config, 'apply')?.fieldId, 'translation-model')
  config.common.translation.enabled = false
  assert.equal(validateEngineConfig(config, 'apply'), null)

  config.providers.glm.url = ''
  config.providers.glm.model = ''
  normalizeEngineConfig(config)
  assert.equal(
    config.providers.glm.url,
    'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions'
  )
  assert.equal(config.providers.glm.model, 'glm-asr-2512')
})

test('chooses provider-supported language defaults from the UI language', () => {
  const config = createDefaultConfig('/recordings').engine

  applyEngineLanguageDefaults(config, 'vosk', 'zh')
  assert.equal(config.common.sourceLanguage, 'auto')
  assert.equal(config.common.targetLanguage, 'zh-cn')

  applyEngineLanguageDefaults(config, 'sosv', 'zh')
  assert.equal(config.common.targetLanguage, 'zh')

  applyEngineLanguageDefaults(config, 'gummy', 'ja')
  assert.equal(config.common.targetLanguage, 'ja')

  applyEngineLanguageDefaults(config, 'fun_asr', 'en')
  assert.equal(config.common.sourceLanguage, 'auto')
  assert.equal(config.common.targetLanguage, 'en')
})

test('describes Fun-ASR connection and segmentation fields through capabilities', () => {
  const fields = getEngineFields('fun_asr')
  const definition = getEngineDefinition('fun_asr')

  assert.ok(fields.some((field) => field.path === 'providers.funAsr.model'))
  assert.ok(fields.some((field) => field.path === 'providers.funAsr.websocketUrl'))
  assert.ok(fields.some((field) => field.path === 'providers.funAsr.workspaceId'))
  assert.ok(fields.some((field) => field.path === 'providers.funAsr.heartbeatEnabled'))
  assert.ok(fields.some((field) => field.path === 'common.translation.provider'))
  assert.equal(definition.capabilities.hotwords, 'manager')

  const config = createDefaultConfig('/recordings').engine
  config.activeEngineId = 'fun_asr'
  config.providers.funAsr.hotwords.vocabularyId = 'vocab-project-1'
  config.providers.funAsr.model = 'fun-asr-realtime-2025-11-07'
  assert.equal(validateEngineConfig(config, 'apply')?.fieldId, 'fun-asr-hotwords')
})

test('validates only the selected custom engine and skips builtin requirements', () => {
  const config = createDefaultConfig('/recordings').engine
  config.providers.vosk.modelPath = ''
  config.customEngines.push({
    id: 'custom-live',
    name: 'Live Engine',
    executable: '',
    command: '--mode live'
  })
  config.activeEngineId = 'custom-live'

  assert.equal(validateEngineConfig(config, 'start')?.fieldId, 'custom-executable')
  config.customEngines[0].executable = '/engines/live'
  assert.equal(validateEngineConfig(config, 'start'), null)
})

test('resolves every catalog label and help key in all supported UI languages', () => {
  const messageCatalogs = [zh, en, ja]
  const messageKeys = new Set()

  for (const definition of engineDefinitions) {
    messageKeys.add(definition.labelKey)
    for (const language of definition.languages) messageKeys.add(language.labelKey)
    for (const field of getEngineFields(definition.id)) {
      messageKeys.add(field.labelKey)
      if (field.helpKey) messageKeys.add(field.helpKey)
      if (field.helpLinkLabelKey) messageKeys.add(field.helpLinkLabelKey)
      for (const option of field.options ?? []) messageKeys.add(option.labelKey)
    }
  }

  for (const messages of messageCatalogs) {
    for (const key of messageKeys) assert.equal(hasMessageKey(messages, key), true, key)
  }
})
