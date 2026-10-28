import assert from 'node:assert/strict'
import { test } from 'node:test'

import { questionErrors, setErrors } from './validate.mjs'

const good = {
  id: 'x-1',
  question: 'Q?',
  choices: ['a', 'b', 'c', 'd', 'e'],
  answer_index: 0,
  explanation: 'E.',
  sources: [{ title: 'T', url: 'https://example.com' }],
  verified_at: '2026-10-28',
  verified_by: 'test',
}

test('accepts a good question and set', () => {
  assert.deepEqual(questionErrors(good), [])
  assert.deepEqual(setErrors({ slug: 'x', subject: 'X', version: '1', questions: [good] }), [])
})

test('rejects missing sources, http sources, bad choices, bad answer index, no provenance', () => {
  assert.ok(questionErrors({ ...good, sources: [] }).length > 0)
  assert.ok(questionErrors({ ...good, sources: [{ title: 'T', url: 'http://example.com' }] }).length > 0)
  assert.ok(questionErrors({ ...good, choices: ['a', 'b', 'c', 'd'] }).length > 0)
  assert.ok(questionErrors({ ...good, choices: ['a', 'A', 'c', 'd', 'e'] }).length > 0)
  assert.ok(questionErrors({ ...good, answer_index: 5 }).length > 0)
  assert.ok(questionErrors({ ...good, verified_by: '' }).length > 0)
})

test('rejects duplicate ids, empty sets and bad slugs', () => {
  assert.ok(setErrors({ slug: 'x', subject: 'X', version: '1', questions: [good, good] }).some(e => e.includes('duplicate')))
  assert.ok(setErrors({ slug: 'x', subject: 'X', version: '1', questions: [] }).length > 0)
  assert.ok(setErrors({ slug: 'Bad Slug', subject: 'X', version: '1', questions: [good] }).length > 0)
})

import { promote } from './promote.mjs'

test('promote keeps only passing verdicts whose pick matches, and strips evidence', () => {
  const drafts = [
    { ...good, id: 'a', evidence: 'quote' },
    { ...good, id: 'b' },
    { ...good, id: 'c' },
    { ...good, id: 'd' },
  ]
  const verdicts = [
    { id: 'a', pick: 0, pass: true, reason: 'ok' },
    { id: 'b', pick: 3, pass: true, reason: 'different pick' },
    { id: 'c', pick: 0, pass: false, reason: 'ambiguous' },
  ]
  const { kept, rejected } = promote(drafts, verdicts, '2026-10-28')
  assert.deepEqual(kept.map(q => q.id), ['a'])
  assert.equal('evidence' in kept[0], false)
  assert.equal(kept[0].verified_by, 'quiz-research v1 (blind verify)')
  assert.deepEqual(rejected.map(q => q.id), ['b', 'c', 'd'])
  assert.match(rejected[2].reason, /no verdict/)
})
