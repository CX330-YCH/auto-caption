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
  assert.deepEqual(records, [first, second])
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
