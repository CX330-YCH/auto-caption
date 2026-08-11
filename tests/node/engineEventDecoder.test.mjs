import assert from 'node:assert/strict'
import test from 'node:test'

import { EngineEventDecoder } from '../../src/main/engine/protocol/EngineEventDecoder.ts'

test('decodes multiple NDJSON messages and ignores blank lines', () => {
  const decoder = new EngineEventDecoder()
  const batch = decoder.push(
    '{"command":"connect"}\r\n\n{"command":"info","content":"ready"}\n'
  )

  assert.deepEqual(batch.errors, [])
  assert.deepEqual(batch.messages.map(({ value }) => value), [
    { command: 'connect' },
    { command: 'info', content: 'ready' }
  ])
})

test('buffers one JSON message across arbitrary chunks', () => {
  const decoder = new EngineEventDecoder()

  assert.deepEqual(decoder.push('{"command":"cap').messages, [])
  const batch = decoder.push('tion","text":"hello"}\n')

  assert.deepEqual(batch.errors, [])
  assert.deepEqual(batch.messages[0].value, {
    command: 'caption',
    text: 'hello'
  })
})

test('preserves a UTF-8 code point split between Buffer chunks', () => {
  const decoder = new EngineEventDecoder()
  const encoded = Buffer.from('{"command":"info","content":"字幕"}\n')
  const splitAt = encoded.indexOf(Buffer.from('字')) + 1

  decoder.push(encoded.subarray(0, splitAt))
  const batch = decoder.push(encoded.subarray(splitAt))

  assert.deepEqual(batch.errors, [])
  assert.equal(batch.messages[0].value.content, '字幕')
})

test('reports one malformed line and continues with the next line', () => {
  const decoder = new EngineEventDecoder()
  const batch = decoder.push('not-json\n{"command":"connect"}\n')

  assert.equal(batch.errors.length, 1)
  assert.equal(batch.errors[0].kind, 'invalid-json')
  assert.equal(batch.errors[0].lineNumber, 1)
  assert.deepEqual(batch.messages[0], {
    lineNumber: 2,
    value: { command: 'connect' }
  })
})

test('accepts one legacy trailing JSON value when the stream closes', () => {
  const decoder = new EngineEventDecoder()

  decoder.push('{"command":"kill"}')
  const batch = decoder.finish()

  assert.deepEqual(batch.errors, [])
  assert.deepEqual(batch.messages[0].value, { command: 'kill' })
})

test('bounds an unfinished oversized line and recovers after its delimiter', () => {
  const decoder = new EngineEventDecoder(32)

  const oversized = decoder.push('{"content":"012345678901234567890123456789')
  const recovered = decoder.push('continued"}\n{"command":"connect"}\n')

  assert.equal(oversized.errors[0].kind, 'line-too-long')
  assert.deepEqual(recovered.errors, [])
  assert.deepEqual(recovered.messages[0].value, { command: 'connect' })
})

test('reset removes pending data and restarts line numbering', () => {
  const decoder = new EngineEventDecoder()

  decoder.push('partial')
  decoder.reset()
  const batch = decoder.push('{"command":"connect"}\n')

  assert.deepEqual(batch.messages[0], {
    lineNumber: 1,
    value: { command: 'connect' }
  })
})
