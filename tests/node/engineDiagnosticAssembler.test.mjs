import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { EngineDiagnosticAssembler } from '../../src/main/engine/protocol/EngineDiagnosticAssembler.ts'

test('reassembles and verifies chunked engine diagnostics', () => {
  const assembler = new EngineDiagnosticAssembler()
  const diagnostic = { version: 1, response: '完整诊断'.repeat(1000) }
  const bytes = Buffer.from(JSON.stringify(diagnostic))
  const encoded = bytes.toString('base64')
  const chunks = [encoded.slice(0, 1000), encoded.slice(1000)]

  for (const [index, content] of chunks.entries()) {
    assert.equal(assembler.accept({
      command: 'diagnostic_chunk',
      id: 'diagnostic-1',
      index,
      count: chunks.length,
      content
    }), null)
  }

  const result = assembler.accept({
    command: 'error',
    content: 'failed',
    diagnostic_ref: {
      id: 'diagnostic-1',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
  })
  assert.deepEqual(result.diagnostic, diagnostic)
})

test('marks missing diagnostic chunks explicitly', () => {
  const assembler = new EngineDiagnosticAssembler()
  assembler.accept({
    command: 'diagnostic_chunk',
    id: 'diagnostic-2',
    index: 0,
    count: 2,
    content: 'e30='
  })
  const result = assembler.accept({
    command: 'error',
    content: 'failed',
    diagnostic_ref: { id: 'diagnostic-2' }
  })
  assert.equal('diagnostic_incomplete' in result, true)
})

test('rejects oversized encoded diagnostics before decoding', () => {
  const assembler = new EngineDiagnosticAssembler()
  assembler.accept({
    command: 'diagnostic_chunk',
    id: 'oversized',
    index: 0,
    count: 1,
    content: 'A'.repeat(45 * 1024 * 1024)
  })
  const result = assembler.accept({
    command: 'error',
    content: 'failed',
    diagnostic_ref: { id: 'oversized' }
  })
  assert.equal('diagnostic_incomplete' in result, true)
})
