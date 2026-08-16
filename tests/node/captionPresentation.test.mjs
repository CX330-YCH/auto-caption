import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVisualLines,
  segmentGraphemes
} from '../../src/renderer/src/captions/visualLines.ts'
import {
  buildRollingCaptionTracks,
  selectRollingCaptionLines
} from '../../src/renderer/src/captions/rollingLines.ts'

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

test('builds independent source and translation tracks from measurements', () => {
  const captions = [{
    captionId: '1:8',
    index: 1,
    time_s: '',
    time_t: '',
    text: 'first second',
    translation: '一 二',
    phase: 'partial'
  }]
  const measurements = new Map([[
    '1:8',
    { source: ['first ', 'second'], translation: ['一 ', '二'] }
  ]])

  const tracks = buildRollingCaptionTracks(captions, measurements, true)

  assert.deepEqual(
    tracks.source.map(({ key, text, kind }) => ({ key, text, kind })),
    [
      { key: '1:8:source:0', text: 'first ', kind: 'source' },
      { key: '1:8:source:1', text: 'second', kind: 'source' }
    ]
  )
  assert.deepEqual(
    tracks.translation.map(({ key, text, kind }) => ({ key, text, kind })),
    [
      { key: '1:8:translation:0', text: '一 ', kind: 'translation' },
      { key: '1:8:translation:1', text: '二', kind: 'translation' }
    ]
  )
  assert.deepEqual(
    buildRollingCaptionTracks(captions, measurements, false)
      .source.map(row => row.kind),
    ['source', 'source']
  )
  assert.deepEqual(
    buildRollingCaptionTracks(captions, measurements, false).translation,
    []
  )
})

test('delayed translation cannot consume the source track row budget', () => {
  const captions = [{
    captionId: 'caption',
    index: 1,
    time_s: '',
    time_t: '',
    text: 'source',
    translation: 'translation',
    phase: 'final'
  }]
  const measurements = new Map([[
    'caption',
    {
      source: ['source 1', 'source 2', 'source 3'],
      translation: ['translation 1', 'translation 2', 'translation 3']
    }
  ]])

  const tracks = buildRollingCaptionTracks(captions, measurements, true)

  assert.deepEqual(
    selectRollingCaptionLines(tracks.source, 2).map(row => row.text),
    ['source 2', 'source 3']
  )
  assert.deepEqual(
    selectRollingCaptionLines(tracks.translation, 2).map(row => row.text),
    ['translation 2', 'translation 3']
  )
})

test('keeps only the configured visual rows for rolling display', () => {
  const rows = Array.from({ length: 5 }, (_, lineIndex) => ({
    key: `caption:source:${lineIndex}`,
    captionId: 'caption',
    kind: 'source',
    lineIndex,
    text: `line ${lineIndex}`,
    phase: 'final'
  }))

  assert.deepEqual(
    selectRollingCaptionLines(rows, 2).map(row => row.text),
    ['line 3', 'line 4']
  )
})
