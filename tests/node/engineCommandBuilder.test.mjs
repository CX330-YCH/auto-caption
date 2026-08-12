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

test('builds common and Provider-specific arguments from V3 config', () => {
  const engine = createDefaultConfig('/recordings').engine
  engine.common.audioSource = 1
  engine.common.recording.enabled = true
  engine.common.translation.apiKey = 'translation-secret'
  engine.providers.gummy.apiKey = 'gummy-secret'
  engine.providers.vosk.modelPath = '/models/vosk'
  engine.providers.sosv.modelPath = '/models/sosv'
  engine.providers.glm.apiKey = 'glm-secret'
  engine.providers.funAsr.workspaceId = 'workspace-1'
  engine.providers.funAsr.websocketUrl = 'wss://workspace-1.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference'
  engine.providers.funAsr.apiKey = 'fun-asr-secret'
  engine.providers.funAsr.hotwords.vocabularyId = 'vocab-project-1'
  engine.providers.funAsr.hotwords.contextTerms = ['Auto Caption', '阿里云百炼']

  for (const provider of ['gummy', 'vosk', 'sosv', 'glm', 'fun_asr']) {
    const args = buildBundledEngineArguments(engine, provider, 2345)

    assert.equal(valueAfter(args, '-a'), '1')
    assert.equal(valueAfter(args, '-p'), '2345')
    assert.equal(valueAfter(args, '-rp'), '"/recordings"')
    assert.equal(valueAfter(args, '-e'), provider)
  }

  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 'gummy', 2345), '-k'),
    'gummy-secret'
  )

  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 'vosk', 2345), '-vosk'),
    '"/models/vosk"'
  )

  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 'sosv', 2345), '-sosv'),
    '"/models/sosv"'
  )

  const glmArgs = buildBundledEngineArguments(engine, 'glm', 2345)
  assert.equal(valueAfter(glmArgs, '-gkey'), 'glm-secret')
  assert.equal(valueAfter(glmArgs, '-okey'), 'translation-secret')

  const funAsrArgs = buildBundledEngineArguments(engine, 'fun_asr', 2345)
  assert.equal(valueAfter(funAsrArgs, '-fmodel'), 'fun-asr-realtime')
  assert.equal(valueAfter(funAsrArgs, '-fworkspace'), 'workspace-1')
  assert.equal(valueAfter(funAsrArgs, '-fkey'), 'fun-asr-secret')
  assert.equal(valueAfter(funAsrArgs, '-fsemantic'), '0')
  assert.equal(valueAfter(funAsrArgs, '-fsilence'), '1300')
  assert.equal(valueAfter(funAsrArgs, '-fheartbeat'), '1')
  assert.equal(valueAfter(funAsrArgs, '-fvocabulary'), 'vocab-project-1')
  assert.equal(valueAfter(funAsrArgs, '-fvmodel'), 'fun-asr-realtime')
  assert.deepEqual(
    funAsrArgs.filter((value, index) => funAsrArgs[index - 1] === '-fcontext'),
    ['Auto Caption', '阿里云百炼']
  )
})

test('uses none target when translation is disabled', () => {
  const engine = createDefaultConfig('').engine
  engine.common.translation.enabled = false

  assert.equal(
    valueAfter(buildBundledEngineArguments(engine, 'vosk', 3456), '-t'),
    'none'
  )
  const args = buildBundledEngineArguments(engine, 'vosk', 3456)
  for (const flag of ['-tm', '-omn', '-ourl', '-okey']) {
    assert.equal(args.includes(flag), false)
  }
})

test('builds custom engine arguments without bundled Provider fields', () => {
  const customEngine = {
    id: 'custom-live',
    name: 'Live Engine',
    executable: '/engines/live',
    command: '--mode live'
  }

  assert.deepEqual(
    buildCustomEngineArguments(customEngine, 4567),
    ['--mode', 'live', '-p', '4567']
  )
})
