import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEngineLaunchContext } from '../../src/main/engine/config/EngineLaunchContext.ts'
import { hasTencentSpeechCredentials } from '../../src/shared/tencentSpeech.ts'

test('keeps legacy stop timeout unchanged', () => {
  for (const provider of [null, 'gummy', 'fun_asr', 'apple_speech']) {
    assert.equal(buildEngineLaunchContext(provider, {}).stopTimeoutMs, 4000)
  }
})

test('passes Tencent credentials only through environment and extends flush timeout', () => {
  const environment = {
    PATH: '/bin',
    TENCENTCLOUD_APP_ID: '123456',
    TENCENTCLOUD_SECRET_ID: 'secret-id',
    TENCENTCLOUD_SECRET_KEY: 'secret-key'
  }
  const context = buildEngineLaunchContext('tencent_speech_translate', environment)

  assert.equal(context.stopTimeoutMs, 8000)
  assert.deepEqual(context.environment, environment)
  assert.deepEqual(context.secrets, ['secret-id', 'secret-key'])
  assert.equal(hasTencentSpeechCredentials(environment), true)
  assert.equal(
    hasTencentSpeechCredentials({
      ...environment,
      TENCENTCLOUD_SECRET_KEY: ''
    }),
    false
  )
})
