import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVisualLines,
  segmentGraphemes
} from '../../src/renderer/src/captions/visualLines.ts'

test('segments Unicode text without splitting surrogate pairs or combining marks', () => {
  const segments = segmentGraphemes('A👩‍💻e\u0301中')

  assert.deepEqual(
    segments.map(segment => segment.text),
    ['A', '👩‍💻', 'e\u0301', '中']
  )
  assert.equal(segments.at(-1).end, 'A👩‍💻e\u0301中'.length)
})

test('groups positioned graphemes into browser visual rows', () => {
  const text = 'hello world'
  const segments = segmentGraphemes(text).map((segment, index) => ({
    ...segment,
    lineTop: index < 6 ? 10 : 34
  }))

  assert.deepEqual(buildVisualLines(text, segments), ['hello ', 'world'])
})

test('keeps explicit empty lines while grouping measured rows', () => {
  const text = 'first\n\nlast'
  const segments = segmentGraphemes(text).map(segment => ({
    ...segment,
    lineTop: segment.start < 5 ? 10 : 34
  }))

  assert.deepEqual(buildVisualLines(text, segments), ['first', '', 'last'])
})
