import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONFIG_SCHEMA_VERSION,
  createDefaultConfig
} from '../../src/shared/config/schema.ts'
import {
  parseApplicationConfig,
  parseConfigDocumentV2,
  parseEngineConfig
} from '../../src/shared/config/document.ts'

test('creates a complete layered V2 document', () => {
  const config = createDefaultConfig('/recordings')

  assert.equal(config.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(config.application.layout.captionWindowWidth, 900)
  assert.equal(config.engine.provider, 'gummy')
  assert.equal(config.engine.common.recording.path, '/recordings')
  assert.equal(config.engine.providers.glm.model, 'glm-asr-2512')
  assert.equal(config.engine.providers.funAsr.model, 'fun-asr-realtime')
  assert.equal(config.engine.providers.funAsr.heartbeatEnabled, true)
  assert.equal(config.caption.styles.fontSize, 24)
  assert.equal('controls' in config, false)
  assert.equal('engineEnabled' in config.engine, false)
})

test('accepts only schema V2 and rejects legacy or future documents', () => {
  const config = createDefaultConfig('/recordings')

  assert.throws(
    () => parseConfigDocumentV2({ controls: {} }),
    /schemaVersion/
  )
  assert.throws(
    () => parseConfigDocumentV2({ ...config, schemaVersion: 3 }),
    /Unsupported config schema version: 3/
  )
})

test('validates nested values while preserving V2 extension fields', () => {
  const config = createDefaultConfig('/recordings')
  config.extensionRoot = { enabled: true }
  config.engine.extensionEngine = 'future-engine-setting'
  config.engine.providers.glm.extensionGlm = 7

  const parsed = parseConfigDocumentV2(config)

  assert.deepEqual(parsed.extensionRoot, { enabled: true })
  assert.equal(parsed.engine.extensionEngine, 'future-engine-setting')
  assert.equal(parsed.engine.providers.glm.extensionGlm, 7)

  assert.throws(
    () => parseEngineConfig({ ...config.engine, provider: 'unknown' }),
    /Invalid Provider/
  )
  assert.throws(
    () => parseEngineConfig({
      ...config.engine,
      providers: {
        ...config.engine.providers,
        glm: { ...config.engine.providers.glm, url: 'file:///tmp/asr' }
      }
    }),
    /Invalid glm.url/
  )
  const funAsr = {
    ...config.engine.providers.funAsr,
    workspaceId: 'workspace-1',
    websocketUrl: 'wss://workspace-1.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference'
  }
  const parsedFunAsr = parseEngineConfig({
    ...config.engine,
    provider: 'fun_asr',
    providers: { ...config.engine.providers, funAsr }
  })
  assert.equal(parsedFunAsr.providers.funAsr.workspaceId, 'workspace-1')
  assert.throws(
    () => parseEngineConfig({
      ...config.engine,
      provider: 'fun_asr',
      providers: {
        ...config.engine.providers,
        funAsr: {
          ...funAsr,
          websocketUrl: 'wss://other.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference'
        }
      }
    }),
    /endpoint\/workspace/
  )
  assert.throws(
    () => parseApplicationConfig({
      ...config.application,
      layout: { ...config.application.layout, leftBarWidth: 99 }
    }),
    /Invalid leftBarWidth/
  )
})
