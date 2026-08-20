import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAPTION_WINDOW_INITIAL_HEIGHT,
  CAPTION_WINDOW_MAX_HEIGHT,
  CAPTION_WINDOW_MAX_WIDTH,
  CAPTION_WINDOW_MIN_HEIGHT,
  CAPTION_WINDOW_MIN_WIDTH,
  lockCaptionWindowHeight,
  normalizeCaptionWindowHeight
} from '../../src/main/CaptionWindowGeometry.ts'

test('accepts only finite caption content heights inside native limits', () => {
  assert.equal(CAPTION_WINDOW_INITIAL_HEIGHT, 100)
  assert.equal(normalizeCaptionWindowHeight(98.2), 99)
  assert.equal(normalizeCaptionWindowHeight(CAPTION_WINDOW_MIN_HEIGHT), 22)
  assert.equal(normalizeCaptionWindowHeight('100'), undefined)
  assert.equal(normalizeCaptionWindowHeight(Number.NaN), undefined)
  assert.equal(normalizeCaptionWindowHeight(CAPTION_WINDOW_MIN_HEIGHT - 1), undefined)
  assert.equal(normalizeCaptionWindowHeight(CAPTION_WINDOW_MAX_HEIGHT + 1), undefined)
})

test('locks native height while preserving the current adjustable width', () => {
  const calls = []
  const target = {
    getSize: () => [900, CAPTION_WINDOW_INITIAL_HEIGHT],
    setMinimumSize: (width, height) => calls.push(['minimum', width, height]),
    setMaximumSize: (width, height) => calls.push(['maximum', width, height]),
    setSize: (width, height) => calls.push(['size', width, height])
  }

  assert.equal(lockCaptionWindowHeight(target, 98.2), true)
  assert.deepEqual(calls, [
    ['maximum', CAPTION_WINDOW_MAX_WIDTH, CAPTION_WINDOW_MAX_HEIGHT],
    ['minimum', CAPTION_WINDOW_MIN_WIDTH, CAPTION_WINDOW_MIN_HEIGHT],
    ['size', 900, 99],
    ['minimum', CAPTION_WINDOW_MIN_WIDTH, 99],
    ['maximum', CAPTION_WINDOW_MAX_WIDTH, 99]
  ])
})

test('does not mutate native bounds for an invalid height report', () => {
  let callCount = 0
  const target = {
    getSize: () => [900, CAPTION_WINDOW_INITIAL_HEIGHT],
    setMinimumSize: () => { callCount += 1 },
    setMaximumSize: () => { callCount += 1 },
    setSize: () => { callCount += 1 }
  }

  assert.equal(lockCaptionWindowHeight(target, null), false)
  assert.equal(callCount, 0)
})
