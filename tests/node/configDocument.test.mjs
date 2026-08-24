import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONFIG_SCHEMA_VERSION,
  createDefaultConfig
} from '../../src/shared/config/schema.ts'
import {
  parseApplicationConfig,
  parseConfigDocumentV6,
  parseEngineConfig
} from '../../src/shared/config/document.ts'

test('creates a complete layered V6 document', () => {
  const config = createDefaultConfig('/recordings')

  assert.equal(config.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(config.application.layout.captionWindowWidth, 900)
  assert.equal(config.application.diagnostics.debugMode, false)
  assert.equal(config.engine.activeEngineId, 'gummy')
  assert.deepEqual(config.engine.customEngines, [])
  assert.equal(config.engine.common.recording.path, '/recordings')
  assert.equal(config.engine.providers.glm.model, 'glm-asr-2512')
  assert.equal(config.engine.providers.funAsr.model, 'fun-asr-realtime')
  assert.equal(config.engine.providers.funAsr.heartbeatEnabled, true)
  assert.deepEqual(config.engine.providers.funAsr.hotwords.contextTerms, [])
  assert.equal(config.caption.styles.fontSize, 24)
  assert.equal(config.caption.styles.displayMode, 'static')
  assert.equal(config.caption.styles.captionBoundaryMode, 'sentence')
  assert.equal('controls' in config, false)
  assert.equal('engineEnabled' in config.engine, false)
})

test('migrates schema V2/V3/V4/V5 and rejects unversioned or future documents', () => {
  const config = createDefaultConfig('/recordings')

  assert.throws(
    () => parseConfigDocumentV6({ controls: {} }),
    /schemaVersion/
  )
  assert.throws(
    () => parseConfigDocumentV6({ ...config, schemaVersion: 7 }),
    /Unsupported config schema version: 7/
  )

  const v2 = {
    ...config,
    schemaVersion: 2,
    engine: {
      ...config.engine,
      provider: 'vosk',
      custom: {
        enabled: true,
        executable: '/engines/legacy',
        command: '--legacy',
        extensionCustom: 'preserved'
      }
    }
  }
  delete v2.engine.activeEngineId
  delete v2.engine.customEngines
  const migrated = parseConfigDocumentV6(v2)
  assert.equal(migrated.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(migrated.engine.activeEngineId, 'custom-migrated')
  assert.deepEqual(migrated.engine.customEngines, [{
    id: 'custom-migrated',
    name: 'Custom Engine',
    executable: '/engines/legacy',
    command: '--legacy',
    extensionCustom: 'preserved'
  }])
  assert.equal(migrated.caption.styles.displayMode, 'static')
  assert.equal(migrated.caption.styles.captionBoundaryMode, 'sentence')

  v2.engine.custom.enabled = false
  const migratedInactive = parseConfigDocumentV6(v2)
  assert.equal(migratedInactive.engine.activeEngineId, 'vosk')
  assert.equal(migratedInactive.engine.customEngines[0].executable, '/engines/legacy')

  const v3 = {
    ...config,
    schemaVersion: 3,
    caption: {
      ...config.caption,
      styles: { ...config.caption.styles }
    }
  }
  delete v3.caption.styles.displayMode
  delete v3.caption.styles.captionBoundaryMode
  v3.caption.styles.extensionStyle = 'preserved'
  const migratedV3 = parseConfigDocumentV6(v3)
  assert.equal(migratedV3.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(migratedV3.caption.styles.displayMode, 'static')
  assert.equal(migratedV3.caption.styles.captionBoundaryMode, 'sentence')
  assert.equal(migratedV3.caption.styles.extensionStyle, 'preserved')

  const v4 = {
    ...config,
    schemaVersion: 4,
    caption: {
      ...config.caption,
      styles: {
        ...config.caption.styles,
        displayMode: 'rolling',
        extensionStyle: 'preserved-v4'
      }
    }
  }
  delete v4.caption.styles.captionBoundaryMode
  const migratedV4 = parseConfigDocumentV6(v4)
  assert.equal(migratedV4.caption.styles.displayMode, 'rolling')
  assert.equal(migratedV4.caption.styles.captionBoundaryMode, 'sentence')
  assert.equal(migratedV4.caption.styles.extensionStyle, 'preserved-v4')

  const v5 = {
    ...config,
    schemaVersion: 5,
    application: {
      ...config.application,
      diagnostics: { extensionField: 'preserved-v5' }
    }
  }
  const migratedV5 = parseConfigDocumentV6(v5)
  assert.equal(migratedV5.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(migratedV5.application.diagnostics.debugMode, false)
  assert.equal(
    migratedV5.application.diagnostics.extensionField,
    'preserved-v5'
  )
})

test('validates nested values while preserving V6 extension fields', () => {
  const config = createDefaultConfig('/recordings')
  config.extensionRoot = { enabled: true }
  config.engine.extensionEngine = 'future-engine-setting'
  config.engine.providers.glm.extensionGlm = 7

  const parsed = parseConfigDocumentV6(config)

  assert.deepEqual(parsed.extensionRoot, { enabled: true })
  assert.equal(parsed.engine.extensionEngine, 'future-engine-setting')
  assert.equal(parsed.engine.providers.glm.extensionGlm, 7)
  const rolling = parseConfigDocumentV6({
    ...config,
    caption: {
      styles: { ...config.caption.styles, displayMode: 'rolling' }
    }
  })
  assert.equal(rolling.caption.styles.displayMode, 'rolling')
  const continuous = parseConfigDocumentV6({
    ...config,
    caption: {
      styles: {
        ...config.caption.styles,
        captionBoundaryMode: 'continuous'
      }
    }
  })
  assert.equal(
    continuous.caption.styles.captionBoundaryMode,
    'continuous'
  )
  assert.throws(
    () => parseConfigDocumentV6({
      ...config,
      caption: {
        styles: { ...config.caption.styles, displayMode: 'unknown' }
      }
    }),
    /Invalid displayMode/
  )
  assert.throws(
    () => parseConfigDocumentV6({
      ...config,
      caption: {
        styles: {
          ...config.caption.styles,
          captionBoundaryMode: 'unknown'
        }
      }
    }),
    /Invalid captionBoundaryMode/
  )

  assert.throws(
    () => parseEngineConfig({ ...config.engine, activeEngineId: 'unknown' }),
    /Active engine does not exist/
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
  const enhancedFunAsr = parseEngineConfig({
    ...config.engine,
    provider: 'fun_asr',
    providers: {
      ...config.engine.providers,
      funAsr: {
        ...funAsr,
        hotwords: {
          vocabularyId: 'vocab-project-1',
          targetModel: 'fun-asr-realtime',
          contextTerms: ['Auto Caption', '阿里云百炼']
        }
      }
    }
  })
  assert.deepEqual(
    enhancedFunAsr.providers.funAsr.hotwords.contextTerms,
    ['Auto Caption', '阿里云百炼']
  )
  assert.throws(
    () => parseEngineConfig({
      ...enhancedFunAsr,
      providers: {
        ...enhancedFunAsr.providers,
        funAsr: {
          ...enhancedFunAsr.providers.funAsr,
          model: 'fun-asr-realtime-2025-11-07'
        }
      }
    }),
    /target model mismatch/
  )
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
  assert.throws(
    () => parseApplicationConfig({
      ...config.application,
      diagnostics: { debugMode: 'yes' }
    }),
    /diagnostics.debugMode/
  )
})

test('accepts selected local font values and legacy CSS font stacks', () => {
  const config = createDefaultConfig('/recordings')
  const selectedFont = parseConfigDocumentV6({
    ...config,
    caption: {
      ...config.caption,
      styles: {
        ...config.caption.styles,
        fontFamily: '"Noto Sans CJK SC"',
        transFontFamily: '"游ゴシック", sans-serif'
      }
    }
  })

  assert.equal(selectedFont.caption.styles.fontFamily, '"Noto Sans CJK SC"')
  assert.equal(
    selectedFont.caption.styles.transFontFamily,
    '"游ゴシック", sans-serif'
  )
})
