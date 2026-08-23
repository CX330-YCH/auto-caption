import assert from 'node:assert/strict'
import test from 'node:test'

import { staticAppleSpeechAvailability } from '../../src/main/engine/AppleSpeechAvailability.ts'

test('hides Apple Speech outside macOS', () => {
  assert.equal(staticAppleSpeechAvailability('win32', '', true)?.state, 'hidden')
  assert.equal(staticAppleSpeechAvailability('linux', '', true)?.state, 'hidden')
})

test('soft-disables Apple Speech for old macOS and missing helper', () => {
  assert.deepEqual(
    staticAppleSpeechAvailability('darwin', '25.6.0', true)?.reason,
    'unsupported_os'
  )
  assert.deepEqual(
    staticAppleSpeechAvailability('darwin', '26.0.0', false)?.reason,
    'helper_missing'
  )
})

test('defers supported macOS to the native capability probe', () => {
  assert.equal(
    staticAppleSpeechAvailability('darwin', '26.0.0', true),
    undefined
  )
})
