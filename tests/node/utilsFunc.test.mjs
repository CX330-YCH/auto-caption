import assert from 'node:assert/strict'
import test from 'node:test'

import {
  passwordMaskingForList,
  passwordMaskingForObject,
  redactSensitiveText,
  redactSensitiveValue,
  sensitiveArgumentValues
} from '../../src/main/utils/UtilsFunc.ts'

test('masks every supported command-line secret without mutating the input', () => {
  const command = [
    '-e', 'gummy',
    '-k', 'dashscope-secret',
    '-okey', 'openai-secret',
    '-gkey', 'glm-secret',
    '-fkey', 'fun-asr-secret',
    '-s', 'zh'
  ]

  assert.deepEqual(passwordMaskingForList(command), [
    '-e', 'gummy',
    '-k', '****************',
    '-okey', '*************',
    '-gkey', '**********',
    '-fkey', '**************',
    '-s', 'zh'
  ])
  assert.equal(command[3], 'dashscope-secret')
})

test('extracts runtime secrets and redacts exact values from SDK stderr', () => {
  const command = ['-e', 'gummy', '-k', 'plain-runtime-key', '-s', 'zh']
  const secrets = sensitiveArgumentValues(command)

  assert.deepEqual(secrets, ['plain-runtime-key'])
  assert.equal(
    redactSensitiveText(
      'SDK rejected plain-runtime-key with Authorization: Bearer abc123',
      secrets
    ),
    'SDK rejected <redacted> with Authorization: Bearer <redacted>'
  )
})

test('preserves token usage metrics while redacting actual token credentials', () => {
  assert.equal(
    redactSensitiveText('Engine Token Usage: 0'),
    'Engine Token Usage: 0'
  )
  assert.equal(
    redactSensitiveText('access token: private-token-value'),
    'access token: <redacted>'
  )
  assert.deepEqual(redactSensitiveValue({
    tokenUsage: 17,
    tokenCount: 23,
    maxTokens: 1024,
    token: 'private-token-value',
    accessToken: 'private-access-token',
    providerApiKey: 'private-api-key'
  }), {
    tokenUsage: 17,
    tokenCount: 23,
    maxTokens: 1024,
    token: '<redacted>',
    accessToken: '<redacted>',
    providerApiKey: '<redacted>'
  })
})

test('masks API key fields case-insensitively and preserves other fields', () => {
  const controls = {
    API_KEY: 'ali-secret',
    glmApiKey: 'glm-secret',
    ollamaApiKey: '',
    model: 'fun-asr-realtime'
  }

  assert.deepEqual(passwordMaskingForObject(controls), {
    API_KEY: '**********',
    glmApiKey: '**********',
    ollamaApiKey: '',
    model: 'fun-asr-realtime'
  })
  assert.equal(controls.API_KEY, 'ali-secret')
})
