import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const fixtureUrl = new URL('../fixtures/engine-events.ndjson', import.meta.url)

async function readFixtureEvents() {
  const content = await readFile(fixtureUrl, 'utf8')
  return content
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}

test('legacy engine protocol fixture contains one JSON object per line', async () => {
  const events = await readFixtureEvents()

  assert.equal(events.length, 6)
  assert.ok(events.every((event) => typeof event.command === 'string'))
  assert.equal(events[0].command, 'connect')
})

test('legacy partial captions reuse index and start time', async () => {
  const events = await readFixtureEvents()
  const captions = events.filter((event) => event.command === 'caption')

  assert.equal(captions[0].index, captions[1].index)
  assert.equal(captions[0].time_s, captions[1].time_s)
  assert.notEqual(captions[1].index, captions[2].index)
})

test('translation events correlate with captions through time_s', async () => {
  const events = await readFixtureEvents()
  const translation = events.find((event) => event.command === 'translation')
  const matchingCaption = events
    .filter((event) => event.command === 'caption' && event.time_s === translation.time_s)
    .at(-1)

  assert.ok(matchingCaption)
  assert.equal(translation.text, matchingCaption.text)
})
