import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEngineLaunchContext } from '../../src/main/engine/config/EngineLaunchContext.ts'
import { hasTencentSpeechCredentials } from '../../src/shared/tencentSpeech.ts'

test('keeps legacy stop timeout unchanged', () => {
  for (const provider of [null, 'gummy', 'fun_asr', 'apple_speech']) {
    assert.equal(buildEngineLaunchContext(provider, {}).stopTimeoutMs, 4000)
  }
})

test('keeps Tencent launch environment generic and extends flush timeout', () => {
  const environment = { PATH: '/bin' }
  for (const provider of [
    'tencent_speech_translate',
    'tencent_speech_recognition',
    'tencent_speech_recognition_v2'
  ]) {
    const context = buildEngineLaunchContext(provider, environment)
    assert.equal(context.stopTimeoutMs, 8000)
    assert.deepEqual(context.environment, environment)
    assert.deepEqual(context.secrets, [])
  }
  assert.equal(hasTencentSpeechCredentials({
    appId: '123456',
    secretId: 'secret-id',
    secretKey: 'secret-key'
  }), true)
  assert.equal(hasTencentSpeechCredentials({
    appId: '123456',
    secretId: 'secret-id',
    secretKey: ''
  }), false)
})
