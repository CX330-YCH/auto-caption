import assert from 'node:assert/strict'
import test from 'node:test'

import { CaptionLog } from '../../src/main/engine/captions/CaptionLog.ts'
import { upsertCaptionItem } from '../../src/shared/captions.ts'

function caption(index, timeStart, text, timeEnd = '00:00:01.000') {
  return {
    command: 'caption',
    index,
    time_s: timeStart,
    time_t: timeEnd,
    text,
    translation: ''
  }
}

test('updates partial and final by stable caption ID when timestamps change', () => {
  const log = new CaptionLog()

  log.upsert(7, caption(1_000_001, '00:00:00.000', '首'))
  const change = log.upsert(
    7,
    caption(1_000_001, '00:00:00.170', '首句完整结果', '00:00:00.920')
  )

  assert.equal(change.position, 0)
  assert.deepEqual(log.items, [{
    captionId: '7:1000001',
    index: 1,
    time_s: '00:00:00.170',
    time_t: '00:00:00.920',
    text: '首句完整结果',
    translation: ''
  }])
})

test('keeps captions distinct when timestamps collide or engine IDs repeat', () => {
  const log = new CaptionLog()

  log.upsert(7, caption(1, '00:00:00.000', 'run seven'))
  log.upsert(7, caption(2, '00:00:00.000', 'same timestamp'))
  log.upsert(8, caption(1, '00:00:00.000', 'run eight'))

  assert.deepEqual(
    log.items.map(({ captionId, index, text }) => ({ captionId, index, text })),
    [
      { captionId: '7:1', index: 1, text: 'run seven' },
      { captionId: '7:2', index: 2, text: 'same timestamp' },
      { captionId: '8:1', index: 3, text: 'run eight' }
    ]
  )
})

test('applies translations by caption ID and falls back for legacy engines', () => {
  const log = new CaptionLog()
  log.upsert(4, caption(9, '00:00:00.000', 'original'))
  log.upsert(4, caption(9, '00:00:00.170', 'corrected'))

  const stable = log.applyTranslation(4, {
    command: 'translation',
    caption_id: 9,
    time_s: '00:00:00.000',
    text: 'original',
    translation: 'stable translation'
  })
  assert.equal(stable?.item.translation, 'stable translation')

  log.upsert(4, caption(10, '00:00:02.000', 'legacy'))
  const legacy = log.applyTranslation(4, {
    command: 'translation',
    time_s: '00:00:02.000',
    text: 'legacy',
    translation: 'legacy translation'
  })
  assert.equal(legacy?.item.captionId, '4:10')
  assert.equal(legacy?.item.translation, 'legacy translation')
})

test('clear removes entries and their stable-position mapping', () => {
  const log = new CaptionLog()
  log.upsert(1, caption(1, '00:00:00.000', 'before clear'))

  log.clear()
  log.upsert(1, caption(1, '00:00:01.000', 'after clear'))

  assert.equal(log.items.length, 1)
  assert.equal(log.items[0].index, 1)
  assert.equal(log.items[0].text, 'after clear')
})

test('renderer upsert inserts a missed add and updates by caption ID', () => {
  const items = []
  const partial = {
    captionId: '2:3',
    index: 1,
    time_s: '00:00:00.000',
    time_t: '00:00:00.200',
    text: 'part',
    translation: ''
  }
  const final = {
    ...partial,
    time_s: '00:00:00.100',
    time_t: '00:00:00.900',
    text: 'complete'
  }

  upsertCaptionItem(items, partial)
  upsertCaptionItem(items, final)

  assert.deepEqual(items, [final])
})
