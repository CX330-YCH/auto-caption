import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONFIG_SCHEMA_VERSION,
  createDefaultConfig
} from '../../src/shared/config/schema.ts'
import {
  parseApplicationConfig,
  parseConfigDocumentV7,
  parseEngineConfig
} from '../../src/shared/config/document.ts'

function asV6(config) {
  const engine = structuredClone(config.engine)
  const translation = engine.translation
  engine.common.targetLanguage = translation.common.targetLanguage
  engine.common.translation = {
    enabled: translation.enabled,
    provider: translation.activeProviderId,
    model: translation.providers.ollama.model,
    url: translation.providers.ollama.url,
    apiKey: translation.providers.ollama.apiKey,
    extensionTranslation: 'preserved-v6'
  }
  delete engine.translation
  return { ...structuredClone(config), schemaVersion: 6, engine }
}

test('creates a complete layered V7 document', () => {
  const config = createDefaultConfig('/recordings')

  assert.equal(config.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(config.application.layout.captionWindowWidth, 900)
  assert.equal(config.application.diagnostics.debugMode, false)
  assert.equal(config.engine.activeEngineId, 'gummy')
  assert.deepEqual(config.engine.customEngines, [])
  assert.equal(config.engine.common.recording.path, '/recordings')
  assert.equal(config.engine.translation.activeProviderId, 'ollama')
  assert.equal(config.engine.translation.common.targetLanguage, 'zh')
  assert.equal(config.engine.translation.providers.ollama.model, 'qwen2.5:0.5b')
  assert.equal(
    config.engine.translation.providers.azure.endpoint,
    'https://api.cognitive.microsofttranslator.com'
  )
  assert.equal('translation' in config.engine.common, false)
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

test('migrates schema V2 through V6 and rejects unversioned or future documents', () => {
  const config = createDefaultConfig('/recordings')
  const legacy = asV6(config)

  assert.throws(
    () => parseConfigDocumentV7({ controls: {} }),
    /schemaVersion/
  )
  assert.throws(
    () => parseConfigDocumentV7({ ...config, schemaVersion: 8 }),
    /Unsupported config schema version: 8/
  )

  const v2 = {
    ...legacy,
    schemaVersion: 2,
    engine: {
      ...legacy.engine,
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
  const migrated = parseConfigDocumentV7(v2)
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
  const migratedInactive = parseConfigDocumentV7(v2)
  assert.equal(migratedInactive.engine.activeEngineId, 'vosk')
  assert.equal(migratedInactive.engine.customEngines[0].executable, '/engines/legacy')

  const v3 = {
    ...legacy,
    schemaVersion: 3,
    caption: {
      ...legacy.caption,
      styles: { ...legacy.caption.styles }
    }
  }
  delete v3.caption.styles.displayMode
  delete v3.caption.styles.captionBoundaryMode
  v3.caption.styles.extensionStyle = 'preserved'
  const migratedV3 = parseConfigDocumentV7(v3)
  assert.equal(migratedV3.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(migratedV3.caption.styles.displayMode, 'static')
  assert.equal(migratedV3.caption.styles.captionBoundaryMode, 'sentence')
  assert.equal(migratedV3.caption.styles.extensionStyle, 'preserved')

  const v4 = {
    ...legacy,
    schemaVersion: 4,
    caption: {
      ...legacy.caption,
      styles: {
        ...legacy.caption.styles,
        displayMode: 'rolling',
        extensionStyle: 'preserved-v4'
      }
    }
  }
  delete v4.caption.styles.captionBoundaryMode
  const migratedV4 = parseConfigDocumentV7(v4)
  assert.equal(migratedV4.caption.styles.displayMode, 'rolling')
  assert.equal(migratedV4.caption.styles.captionBoundaryMode, 'sentence')
  assert.equal(migratedV4.caption.styles.extensionStyle, 'preserved-v4')

  const v5 = {
    ...legacy,
    schemaVersion: 5,
    application: {
      ...legacy.application,
      diagnostics: { extensionField: 'preserved-v5' }
    }
  }
  const migratedV5 = parseConfigDocumentV7(v5)
  assert.equal(migratedV5.schemaVersion, CONFIG_SCHEMA_VERSION)
  assert.equal(migratedV5.application.diagnostics.debugMode, false)
  assert.equal(
    migratedV5.application.diagnostics.extensionField,
    'preserved-v5'
  )

  const migratedV6 = parseConfigDocumentV7(legacy)
  assert.equal(migratedV6.engine.translation.activeProviderId, 'ollama')
  assert.equal(migratedV6.engine.translation.common.targetLanguage, 'zh')
  assert.equal(
    migratedV6.engine.translation.providers.ollama.model,
    'qwen2.5:0.5b'
  )
  assert.equal(migratedV6.engine.translation.extensionTranslation, 'preserved-v6')
  assert.equal('translation' in migratedV6.engine.common, false)
  assert.equal('targetLanguage' in migratedV6.engine.common, false)
})

test('validates nested values while preserving V7 extension fields', () => {
  const config = createDefaultConfig('/recordings')
  config.extensionRoot = { enabled: true }
  config.engine.extensionEngine = 'future-engine-setting'
  config.engine.providers.glm.extensionGlm = 7

  const parsed = parseConfigDocumentV7(config)

  assert.deepEqual(parsed.extensionRoot, { enabled: true })
  assert.equal(parsed.engine.extensionEngine, 'future-engine-setting')
  assert.equal(parsed.engine.providers.glm.extensionGlm, 7)
  const rolling = parseConfigDocumentV7({
    ...config,
    caption: {
      styles: { ...config.caption.styles, displayMode: 'rolling' }
    }
  })
  assert.equal(rolling.caption.styles.displayMode, 'rolling')
  const continuous = parseConfigDocumentV7({
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
    () => parseConfigDocumentV7({
      ...config,
      caption: {
        styles: { ...config.caption.styles, displayMode: 'unknown' }
      }
    }),
    /Invalid displayMode/
  )
  assert.throws(
    () => parseConfigDocumentV7({
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
  assert.throws(
    () => parseEngineConfig({
      ...config.engine,
      translation: {
        ...config.engine.translation,
        activeProviderId: 'missing'
      }
    }),
    /translation.activeProviderId/
  )
  assert.throws(
    () => parseEngineConfig({
      ...config.engine,
      translation: {
        ...config.engine.translation,
        providers: {
          ...config.engine.translation.providers,
          ollama: {
            ...config.engine.translation.providers.ollama,
            url: 'file:///tmp/translation'
          }
        }
      }
    }),
    /translation.providers.ollama.url/
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
  const selectedFont = parseConfigDocumentV7({
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
