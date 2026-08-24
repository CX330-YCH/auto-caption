import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  DebugLogSession,
  isVisibleLogLevel,
  persistAndRouteLogRecord
} from '../../src/main/logging/DebugLogSession.ts'
import {
  redactSensitiveText,
  redactSensitiveValue
} from '../../src/main/utils/UtilsFunc.ts'

test('debug session preserves records written before and after initialization', () => {
  const directory = mkdtempSync(join(tmpdir(), 'auto-caption-debug-'))
  const exported = join(directory, 'export.jsonl')
  const session = new DebugLogSession()
  const first = {
    sequence: 1,
    timestamp: '2026-08-13T00:00:00.000Z',
    level: 'DEBUG',
    source: 'test',
    message: 'before ready'
  }
  const second = {
    ...first,
    sequence: 2,
    level: 'INFO',
    message: 'after ready'
  }

  session.append(first)
  session.initialize(directory, new Date('2026-08-13T00:00:00.000Z'))
  session.append(second)
  assert.equal(session.exportTo(exported), true)

  const records = readFileSync(exported, 'utf8').trim().split('\n').map(JSON.parse)
  assert.deepEqual(
    records.map((record) => ({
      sequence: record.sequence,
      timestamp: record.timestamp,
      level: record.level,
      source: record.source,
      message: record.message
    })),
    [first, second]
  )
  assert.ok(records.every((record) => record.recordVersion === 2))
  assert.equal(new Set(records.map((record) => record.sessionId)).size, 1)
})

test('recursive debug redaction preserves diagnostics but removes credentials', () => {
  const cause = new Error('Bearer cause-secret')
  const sdkError = new Error('request failed for runtime-key', { cause })
  sdkError.code = 'SDK_FAILED'
  sdkError.response = {
    status: 403,
    authorization: 'Bearer response-secret'
  }
  const redacted = redactSensitiveValue({
    requestId: 'request-1',
    code: 'InvalidApiKey',
    apiKey: 'sk-example-secret-value',
    sdkError,
    nested: {
      authorization: 'Bearer private-value',
      command: ['-e', 'fun_asr', '-fkey', 'plain-secret']
    }
  }, ['runtime-key'])

  assert.deepEqual(redacted, {
    requestId: 'request-1',
    code: 'InvalidApiKey',
    apiKey: '<redacted>',
    sdkError: {
      name: 'Error',
      message: 'request failed for <redacted>',
      stack: redacted.sdkError.stack,
      cause: {
        name: 'Error',
        message: 'Bearer <redacted>',
        stack: redacted.sdkError.cause.stack
      },
      code: 'SDK_FAILED',
      response: {
        status: 403,
        authorization: '<redacted>'
      }
    },
    nested: {
      authorization: '<redacted>',
      command: ['-e', 'fun_asr', '-fkey', '<redacted>']
    }
  })
  assert.equal(
    redactSensitiveText('Authorization: Bearer top-secret'),
    'Authorization: Bearer <redacted>'
  )
  assert.equal(
    redactSensitiveText('Authorization: Basic dXNlcjpwYXNz'),
    'Authorization: Basic <redacted>'
  )
  assert.equal(
    redactSensitiveText('Cookie: session=private-value'),
    'Cookie: <redacted>'
  )
})

test('config validation diagnostics preserve the error reason and stack', () => {
  const error = new Error('Invalid engine.providers.gummy.apiKey')
  error.name = 'InvalidConfigError'

  const diagnostic = redactSensitiveValue({
    version: 1,
    operation: 'config.read',
    error
  })

  assert.equal(diagnostic.error.name, 'InvalidConfigError')
  assert.equal(
    diagnostic.error.message,
    'Invalid engine.providers.gummy.apiKey'
  )
  assert.match(diagnostic.error.stack, /InvalidConfigError/)
  assert.match(diagnostic.error.stack, /Invalid engine\.providers\.gummy\.apiKey/)
})

test('diagnostic serialization summarizes binary data and bounds recursion', () => {
  const binary = redactSensitiveValue(Buffer.alloc(4096, 7))
  assert.deepEqual(binary, { type: 'Buffer', byteLength: 4096 })

  let nested = { value: 'leaf' }
  for (let index = 0; index < 20; index++) nested = { nested }
  assert.match(JSON.stringify(redactSensitiveValue(nested)), /max-depth-exceeded/)
})

test('debug is file-only while existing user-facing levels remain visible', () => {
  assert.equal(isVisibleLogLevel('DEBUG'), false)
  assert.equal(isVisibleLogLevel('INFO'), true)
  assert.equal(isVisibleLogLevel('WARN'), true)
  assert.equal(isVisibleLogLevel('ERROR'), true)
})

test('the production routing boundary persists debug without exposing it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'auto-caption-routing-'))
  const session = new DebugLogSession()
  const exposed = []
  session.initialize(directory, new Date('2026-08-13T00:00:00.000Z'))

  for (const [sequence, level] of [
    [1, 'DEBUG'],
    [2, 'INFO'],
    [3, 'WARN'],
    [4, 'ERROR']
  ]) {
    persistAndRouteLogRecord(session, {
      sequence,
      timestamp: '2026-08-13T00:00:00.000Z',
      level,
      source: 'test',
      message: level
    }, (visibleLevel) => exposed.push(visibleLevel))
  }

  const records = readFileSync(session.path, 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse)
  assert.deepEqual(records.map((record) => record.level), [
    'DEBUG', 'INFO', 'WARN', 'ERROR'
  ])
  assert.deepEqual(exposed, ['INFO', 'WARN', 'ERROR'])
})
