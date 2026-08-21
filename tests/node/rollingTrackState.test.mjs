import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCaptionTrackSegments,
  buildRollingCaptionLines,
  composeCaptionTrack
} from '../../src/renderer/src/captions/captionTracks.ts'
import {
  createRollingTrackPresentationState,
  resetRollingTrackDisplayFloor,
  updateRollingTrackPresentation
} from '../../src/renderer/src/captions/rollingTrackState.ts'

test('does not backfill evicted history when a partial shrinks and grows', () => {
  let state = createRollingTrackPresentationState()

  const initial = measuredTrack([
    caption('1', '甲甲甲甲甲乙乙乙乙乙', 'final'),
    caption('2', '丙丙丙丙丙丁丁丁丁丁', 'partial')
  ])
  let update = updateRollingTrackPresentation(
    state,
    initial.track,
    initial.rows,
    2,
    false
  )
  state = update.state
  assert.deepEqual(rowTexts(state), ['丙丙丙丙丙', '丁丁丁丁丁'])
  assert.deepEqual(state.displayFloor, {
    captionId: '2',
    kind: 'source',
    captionOffset: 0
  })

  const shortened = measuredTrack([
    caption('1', '甲甲甲甲甲乙乙乙乙乙', 'final'),
    caption('2', '丙丙丙丙丙', 'partial')
  ])
  update = updateRollingTrackPresentation(
    state,
    shortened.track,
    shortened.rows,
    2,
    false
  )
  state = update.state
  assert.deepEqual(rowTexts(state), ['丙丙丙丙丙'])
  assert.equal(update.animate, false)

  const regrown = measuredTrack([
    caption('1', '甲甲甲甲甲乙乙乙乙乙', 'final'),
    caption('2', '丙丙丙丙丙丁丁丁丁丁', 'partial')
  ])
  update = updateRollingTrackPresentation(
    state,
    regrown.track,
    regrown.rows,
    2,
    true
  )
  assert.deepEqual(rowTexts(update.state), ['丙丙丙丙丙', '丁丁丁丁丁'])
  assert.equal(update.animate, true)
})

test('keeps the display floor when a revision removes all text after it', () => {
  const initial = measuredTrack([
    caption('1', '甲甲甲甲甲乙乙乙乙乙丙丙丙丙丙', 'partial')
  ])
  let state = updateRollingTrackPresentation(
    createRollingTrackPresentationState(),
    initial.track,
    initial.rows,
    2,
    false
  ).state
  assert.equal(state.displayFloor?.captionOffset, 5)

  const shortened = measuredTrack([
    caption('1', '甲甲甲甲甲', 'partial')
  ])
  state = updateRollingTrackPresentation(
    state,
    shortened.track,
    shortened.rows,
    2,
    false
  ).state

  assert.deepEqual(rowTexts(state), [])
  assert.equal(state.displayFloor?.captionOffset, 5)

  const nextCaption = measuredTrack([
    caption('1', '甲甲甲甲甲', 'final'),
    caption('2', '乙乙乙乙乙', 'partial')
  ])
  state = updateRollingTrackPresentation(
    state,
    nextCaption.track,
    nextCaption.rows,
    2,
    true
  ).state
  assert.deepEqual(rowTexts(state), ['乙乙乙乙乙'])
  assert.equal(state.displayFloor?.captionId, '2')
})

test('advances the display floor but never moves it back', () => {
  const initial = measuredTrack([
    caption('1', '甲甲甲甲甲乙乙乙乙乙', 'final')
  ])
  let state = updateRollingTrackPresentation(
    createRollingTrackPresentationState(),
    initial.track,
    initial.rows,
    2,
    false
  ).state

  const appended = measuredTrack([
    caption('1', '甲甲甲甲甲乙乙乙乙乙', 'final'),
    caption('2', '丙丙丙丙丙', 'partial')
  ])
  state = updateRollingTrackPresentation(
    state,
    appended.track,
    appended.rows,
    2,
    true
  ).state
  assert.deepEqual(rowTexts(state), ['乙乙乙乙乙', '丙丙丙丙丙'])
  assert.deepEqual(state.displayFloor, {
    captionId: '1',
    kind: 'source',
    captionOffset: 5
  })

  const shortened = measuredTrack([
    caption('1', '甲甲甲甲甲乙乙乙乙乙', 'final')
  ])
  state = updateRollingTrackPresentation(
    state,
    shortened.track,
    shortened.rows,
    2,
    false
  ).state
  assert.deepEqual(rowTexts(state), ['乙乙乙乙乙'])
  assert.equal(state.displayFloor?.captionOffset, 5)
})

test('keeps late historical translation behind an independent floor', () => {
  const initial = measuredTrack([
    translatedCaption('2', '乙乙乙乙乙'),
    translatedCaption('3', '丙丙丙丙丙')
  ], 'translation')
  let state = updateRollingTrackPresentation(
    createRollingTrackPresentationState(),
    initial.track,
    initial.rows,
    2,
    false
  ).state
  assert.equal(state.displayFloor?.captionId, '2')

  const backfilled = measuredTrack([
    translatedCaption('1', '甲甲甲甲甲'),
    translatedCaption('2', '乙乙乙乙乙'),
    translatedCaption('3', '丙丙丙丙丙')
  ], 'translation')
  state = updateRollingTrackPresentation(
    state,
    backfilled.track,
    backfilled.rows,
    2,
    false
  ).state

  assert.equal(rowTexts(state).join('').includes('甲'), false)
  assert.equal(state.displayFloor?.captionId, '2')
})

test('allows explicit layout reset to select history again', () => {
  const measured = measuredTrack([
    caption('1', '甲甲甲甲甲', 'final'),
    caption('2', '乙乙乙乙乙', 'final'),
    caption('3', '丙丙丙丙丙', 'partial')
  ])
  let state = updateRollingTrackPresentation(
    createRollingTrackPresentationState(),
    measured.track,
    measured.rows,
    2,
    false
  ).state
  assert.deepEqual(rowTexts(state), ['乙乙乙乙乙', '丙丙丙丙丙'])

  state = resetRollingTrackDisplayFloor(state)
  state = updateRollingTrackPresentation(
    state,
    measured.track,
    measured.rows,
    3,
    false
  ).state
  assert.deepEqual(rowTexts(state), [
    '甲甲甲甲甲',
    '乙乙乙乙乙',
    '丙丙丙丙丙'
  ])
})

test('updates partial rows to final without moving or animating them', () => {
  const partial = measuredTrack([
    caption('1', '甲甲甲甲甲', 'partial')
  ])
  let state = updateRollingTrackPresentation(
    createRollingTrackPresentationState(),
    partial.track,
    partial.rows,
    2,
    false
  ).state
  assert.equal(state.visibleRows[0].phase, 'partial')

  const finalized = measuredTrack([
    caption('1', '甲甲甲甲甲', 'final')
  ])
  const update = updateRollingTrackPresentation(
    state,
    finalized.track,
    finalized.rows,
    2,
    false
  )
  state = update.state

  assert.equal(state.visibleRows[0].phase, 'final')
  assert.equal(state.displayFloor?.captionOffset, 0)
  assert.equal(update.animate, false)
})

function measuredTrack(captions, kind = 'source', rowLength = 5) {
  const track = composeCaptionTrack(
    buildCaptionTrackSegments(captions, kind),
    'continuous'
  )
  const lines = []
  for (let start = 0; start < track.text.length; start += rowLength) {
    const end = Math.min(track.text.length, start + rowLength)
    lines.push({ text: track.text.slice(start, end), start, end })
  }
  return {
    track,
    rows: buildRollingCaptionLines(track, lines)
  }
}

function rowTexts(state) {
  return state.visibleRows.map(row => row.text)
}

function caption(captionId, text, phase) {
  return {
    captionId,
    index: Number(captionId),
    time_s: '',
    time_t: '',
    text,
    translation: '',
    phase
  }
}

function translatedCaption(captionId, translation) {
  return {
    ...caption(captionId, '', 'final'),
    translation
  }
}
