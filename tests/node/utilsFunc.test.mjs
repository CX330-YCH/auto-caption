import assert from 'node:assert/strict'
import test from 'node:test'

import {
  passwordMaskingForList,
  passwordMaskingForObject
} from '../../src/main/utils/UtilsFunc.ts'

test('masks every supported command-line secret without mutating the input', () => {
  const command = [
    '-e', 'gummy',
    '-k', 'dashscope-secret',
    '-okey', 'openai-secret',
    '-gkey', 'glm-secret',
    '-s', 'zh'
  ]

  assert.deepEqual(passwordMaskingForList(command), [
    '-e', 'gummy',
    '-k', '****************',
    '-okey', '*************',
    '-gkey', '**********',
    '-s', 'zh'
  ])
  assert.equal(command[3], 'dashscope-secret')
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
