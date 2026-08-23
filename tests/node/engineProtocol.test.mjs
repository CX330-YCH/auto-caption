import assert from 'node:assert/strict'
import test from 'node:test'

import { EngineProtocol } from '../../src/main/engine/protocol/EngineProtocol.ts'
import {
  isCaptionEngineMessage,
  isCaptionRemoveEngineMessage,
  isContentEngineMessage,
  isTranslationEngineMessage
} from '../../src/main/engine/protocol/messages.ts'

test('encodes Electron commands as newline-delimited JSON', () => {
  const protocol = new EngineProtocol()

  assert.equal(
    protocol.encodeCommand('stop'),
    '{"command":"stop","content":""}\n'
  )
})

test('validates additive caption removal events', () => {
  assert.equal(isCaptionRemoveEngineMessage({
    command: 'caption_remove', event_version: 1, index: 3
  }), true)
  assert.equal(isCaptionRemoveEngineMessage({
    command: 'caption_remove', event_version: 2, index: 3
  }), false)
  assert.equal(isCaptionRemoveEngineMessage({
    command: 'caption_remove', event_version: 1, index: '3'
  }), false)
})

test('rejects parsed values without a command envelope', () => {
  const protocol = new EngineProtocol()
  const batch = protocol.push('{}\n[]\n{"command":"connect"}\n')

  assert.equal(batch.errors.length, 2)
  assert.ok(batch.errors.every(({ kind }) => kind === 'invalid-message'))
  assert.deepEqual(batch.messages, [{ command: 'connect' }])
})

test('validates caption event fields', () => {
  const valid = {
    command: 'caption',
    index: 1,
    time_s: '00:00:00.000',
    time_t: '00:00:01.000',
    text: 'hello',
    translation: ''
  }

  assert.equal(isCaptionEngineMessage(valid), true)
  assert.equal(isCaptionEngineMessage({
    ...valid,
    event_version: 1,
    phase: 'partial'
  }), true)
  assert.equal(isCaptionEngineMessage({ ...valid, phase: 'final' }), false)
  assert.equal(isCaptionEngineMessage({
    ...valid,
    event_version: 2,
    phase: 'final'
  }), false)
  assert.equal(isCaptionEngineMessage({ ...valid, index: Number.NaN }), false)
  assert.equal(isCaptionEngineMessage({ ...valid, translation: null }), false)
})

test('validates translation and content event fields', () => {
  const translation = {
    command: 'translation',
    caption_id: 1,
    time_s: '00:00:00.000',
    text: 'hello',
    translation: '你好'
  }

  assert.equal(isTranslationEngineMessage(translation), true)
  assert.equal(
    isTranslationEngineMessage({ ...translation, caption_id: undefined }),
    true
  )
  assert.equal(
    isTranslationEngineMessage({ ...translation, caption_id: '1' }),
    false
  )
  assert.equal(isTranslationEngineMessage({ ...translation, time_s: 0 }), false)
  assert.equal(isContentEngineMessage({ command: 'info', content: 'ready' }), true)
  assert.equal(isContentEngineMessage({ command: 'info' }), false)
})
