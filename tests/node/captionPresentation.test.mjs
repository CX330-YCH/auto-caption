import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVisualLineSlices,
  buildVisualLines,
  segmentGraphemes
} from '../../src/renderer/src/captions/visualLines.ts'
import {
  buildCaptionTrackSegments,
  buildRollingCaptionLines,
  captionTrackAnchorAtOffset,
  captionSegmentSeparator,
  classifyCaptionTrackMutation,
  composeCaptionTrack,
  selectCaptionTrackWindow,
  selectCaptionTrackFromAnchor,
  selectRollingCaptionLines
} from '../../src/renderer/src/captions/captionTracks.ts'

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
  assert.deepEqual(buildVisualLineSlices(text, segments), [
    { text: 'first', start: 0, end: 5 },
    { text: '', start: 6, end: 6 },
    { text: 'last', start: 7, end: 11 }
  ])
})

test('builds ordered source and available translation segments', () => {
  const captions = [
    caption('1', '第一句。', ''),
    caption('2', '第二句。', 'Second sentence.'),
    caption('3', '第三句。', 'Third sentence.', 'partial')
  ]

  assert.deepEqual(
    buildCaptionTrackSegments(captions, 'source').map(segment => ({
      captionId: segment.captionId,
      text: segment.text,
      phase: segment.phase
    })),
    [
      { captionId: '1', text: '第一句。', phase: 'final' },
      { captionId: '2', text: '第二句。', phase: 'final' },
      { captionId: '3', text: '第三句。', phase: 'partial' }
    ]
  )
  assert.deepEqual(
    buildCaptionTrackSegments(captions, 'translation').map(segment => ({
      captionId: segment.captionId,
      text: segment.text
    })),
    [
      { captionId: '2', text: 'Second sentence.' },
      { captionId: '3', text: 'Third sentence.' }
    ]
  )
})

test('composes sentence boundaries or continuous text through one track model', () => {
  const source = buildCaptionTrackSegments([
    caption('1', '第一句。', ''),
    caption('2', '第二句。', '')
  ], 'source')
  const translation = buildCaptionTrackSegments([
    caption('1', '', 'First sentence.'),
    caption('2', '', 'Second sentence.')
  ], 'translation')

  assert.equal(composeCaptionTrack(source, 'sentence').text, '第一句。\n第二句。')
  assert.equal(composeCaptionTrack(source, 'continuous').text, '第一句。第二句。')
  assert.equal(
    composeCaptionTrack(translation, 'continuous').text,
    'First sentence. Second sentence.'
  )
  assert.equal(captionSegmentSeparator('hello', 'world'), ' ')
  assert.equal(captionSegmentSeparator('你好。', '世界'), '')
  assert.equal(captionSegmentSeparator('hello ', 'world'), '')
  assert.equal(captionSegmentSeparator('value', ','), '')
})

test('maps measured rows to stable caption offsets and line phases', () => {
  const segments = buildCaptionTrackSegments([
    caption('1', 'first ', '', 'final'),
    caption('2', 'second partial', '', 'partial')
  ], 'source')
  const track = composeCaptionTrack(segments, 'continuous')
  const rows = buildRollingCaptionLines(track, [
    { text: 'first second ', start: 0, end: 13 },
    { text: 'partial', start: 13, end: 20 }
  ])

  assert.deepEqual(rows.map(row => ({
    key: row.key,
    captionId: row.captionId,
    text: row.text,
    phase: row.phase
  })), [
    {
      key: 'source:1:0',
      captionId: '1',
      text: 'first second ',
      phase: 'partial'
    },
    {
      key: 'source:2:7',
      captionId: '2',
      text: 'partial',
      phase: 'partial'
    }
  ])

  assert.deepEqual(
    selectRollingCaptionLines(rows, 2).map(row => row.text),
    ['first second ', 'partial']
  )
})

test('classifies tail changes separately from historical translation backfill', () => {
  const first = buildCaptionTrackSegments([
    caption('1', 'one', ''),
    caption('2', 'two', '', 'partial')
  ], 'source')
  const partial = buildCaptionTrackSegments([
    caption('1', 'one', ''),
    caption('2', 'two updated', '', 'partial')
  ], 'source')
  const appended = buildCaptionTrackSegments([
    caption('1', 'one', ''),
    caption('2', 'two updated', ''),
    caption('3', 'three', '', 'partial')
  ], 'source')
  const backfilled = buildCaptionTrackSegments([
    caption('0', 'zero', ''),
    caption('1', 'one', ''),
    caption('2', 'two updated', ''),
    caption('3', 'three', '', 'partial')
  ], 'source')

  assert.equal(classifyCaptionTrackMutation(first, partial), 'tail-update')
  assert.equal(classifyCaptionTrackMutation(partial, appended), 'tail-append')
  assert.equal(
    classifyCaptionTrackMutation(appended, backfilled),
    'historical-reflow'
  )
})

test('bounds the measured track window and preserves cropped caption offsets', () => {
  const segments = buildCaptionTrackSegments([
    caption('1', 'old', ''),
    caption('2', 'A👩‍💻BCDE', '')
  ], 'source')
  const selected = selectCaptionTrackWindow(segments, 10, 10, 5)

  assert.equal(selected.length, 1)
  assert.equal(selected[0].text, 'BCDE')
  assert.equal(selected[0].textOffset, 6)
  const track = composeCaptionTrack(selected, 'continuous')
  const [line] = buildRollingCaptionLines(track, [
    { text: 'BCDE', start: 0, end: 4 }
  ])
  assert.equal(line.key, 'source:2:6')
})

test('does not retain an empty segment when the character window is exactly full', () => {
  const segments = buildCaptionTrackSegments([
    caption('1', 'old', ''),
    caption('2', '12345', '')
  ], 'source')

  const selected = selectCaptionTrackWindow(segments, 10, 10, 5)

  assert.deepEqual(selected.map(segment => ({
    captionId: segment.captionId,
    text: segment.text,
    textOffset: segment.textOffset
  })), [
    { captionId: '2', text: '12345', textOffset: 0 }
  ])
  assert.equal(composeCaptionTrack(selected, 'sentence').text, '12345')
})

test('retains a measured visual-line anchor while the track tail grows', () => {
  const initial = buildCaptionTrackSegments([
    caption('1', 'first sentence', ''),
    caption('2', 'second sentence', '')
  ], 'source')
  const track = composeCaptionTrack(initial, 'continuous')
  const anchor = captionTrackAnchorAtOffset(track, 9)

  assert.deepEqual(anchor, {
    captionId: '1',
    kind: 'source',
    captionOffset: 9
  })

  const appended = buildCaptionTrackSegments([
    caption('1', 'first sentence', ''),
    caption('2', 'second sentence', ''),
    caption('3', 'third sentence', '')
  ], 'source')
  const selected = selectCaptionTrackFromAnchor(appended, anchor)

  assert.equal(selected[0].captionId, '1')
  assert.equal(selected[0].text, 'tence')
  assert.equal(selected[0].textOffset, 9)
  assert.equal(
    composeCaptionTrack(selected, 'continuous').text,
    'tence second sentence third sentence'
  )
})

function caption(
  captionId,
  text,
  translation,
  phase = 'final'
) {
  return {
    captionId,
    index: Number(captionId) || 1,
    time_s: '',
    time_t: '',
    text,
    translation,
    phase
  }
}
