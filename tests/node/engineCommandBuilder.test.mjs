import assert from 'node:assert/strict'
import test from 'node:test'

import { createDefaultConfig } from '../../src/shared/config/schema.ts'
import {
  buildBundledEngineArguments,
  buildCustomEngineArguments
} from '../../src/main/engine/config/EngineCommandBuilder.ts'

function valueAfter(args, flag) {
  const index = args.indexOf(flag)
  assert.notEqual(index, -1, `missing ${flag}`)
  return args[index + 1]
}

test('builds common and Provider-specific arguments from V2 config', () => {
  const engine = createDefaultConfig('/recordings').engine
  engine.common.audioSource = 1
  engine.common.recording.enabled = true
  engine.common.translation.apiKey = 'translation-secret'
  engine.providers.gummy.apiKey = 'gummy-secret'
  engine.providers.vosk.modelPath = '/models/vosk'
  engine.providers.sosv.modelPath = '/models/sosv'
  engine.providers.glm.apiKey = 'glm-secret'

  for (const provider of ['gummy', 'vosk', 'sosv', 'glm']) {
    engine.provider = provider
    const args = buildBundledEngineArguments(engine, 2345)

    assert.equal(valueAfter(args, '-a'), '1')
    assert.equal(valueAfter(args, '-p'), '2345')
    assert.equal(valueAfter(args, '-rp'), '"/recordings"')
    assert.equal(valueAfter(args, '-e'), provider)
  }

  engine.provider = 'gummy'
  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 2345), '-k'),
    'gummy-secret'
  )

  engine.provider = 'vosk'
  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 2345), '-vosk'),
    '"/models/vosk"'
  )

  engine.provider = 'sosv'
  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 2345), '-sosv'),
    '"/models/sosv"'
  )

  engine.provider = 'glm'
  const glmArgs = buildBundledEngineArguments(engine, 2345)
  assert.equal(valueAfter(glmArgs, '-gkey'), 'glm-secret')
  assert.equal(valueAfter(glmArgs, '-okey'), 'translation-secret')
})

test('uses none target when translation is disabled', () => {
  const engine = createDefaultConfig('').engine
  engine.common.translation.enabled = false

  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 3456), '-t'),
    'none'
  )
})

test('builds custom engine arguments without bundled Provider fields', () => {
  const engine = createDefaultConfig('').engine
  engine.custom.enabled = true
  engine.custom.command = '--mode live'

  assert.deepEqual(
    buildCustomEngineArguments(engine, 4567),
    ['--mode', 'live', '-p', '4567']
  )
})
