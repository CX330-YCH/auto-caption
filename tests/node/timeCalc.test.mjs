import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getMsFromTime,
  getNewTimeStr,
  getStrFromTime,
  getTimeFromMs,
  getTimeFromStr
} from '../../src/renderer/src/utils/timeCalc.ts'

test('parses the persisted caption time format', () => {
  assert.deepEqual(getTimeFromStr('12:34:56.789'), {
    hh: 12,
    mm: 34,
    ss: 56,
    ms: 789
  })
})

test('converts between structured time and milliseconds', () => {
  const time = { hh: 1, mm: 2, ss: 3, ms: 4 }

  assert.equal(getMsFromTime(time), 3_723_004)
  assert.deepEqual(getTimeFromMs(3_723_004), time)
})

test('preserves the current unpadded display format', () => {
  assert.equal(getStrFromTime({ hh: 1, mm: 2, ss: 3, ms: 4 }), '1:2:3.4')
})

test('adds offsets without wrapping at 24 hours', () => {
  assert.equal(getNewTimeStr('23:59:59.900', 200), '24:0:0.100')
})
