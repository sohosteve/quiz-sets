#!/usr/bin/env node
// Promotes blind-verified drafts into sets/<slug>.json.
//   node scripts/promote.mjs --slug <slug> --subject "<subject>" --drafts a.json,b.json --verdicts va.json,vb.json
// A draft is kept only when its verdict passed AND the verifier's pick equals
// answer_index. Everything else is appended to pending_review/<slug>-rejected.json.
// An existing set is extended (ids already in it are kept, not replaced).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { setErrors } from './validate.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERIFIED_BY = 'quiz-research v1 (blind verify)'

export function promote(drafts, verdicts, today) {
  const byId = new Map(verdicts.map(v => [v.id, v]))
  const kept = []
  const rejected = []
  for (const draft of drafts) {
    const v = byId.get(draft.id)
    const reason = !v
      ? 'no verdict'
      : !v.pass
        ? `verifier failed it: ${v.reason}`
        : v.pick !== draft.answer_index
          ? `verifier picked ${v.pick}, draft says ${draft.answer_index}: ${v.reason}`
          : null
    if (reason) {
      rejected.push({ ...draft, rejected_at: today, reason })
      continue
    }
    const { evidence, ...question } = draft
    kept.push({ ...question, verified_at: today, verified_by: VERIFIED_BY })
  }
  return { kept, rejected }
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const list = value => (value ?? '').split(',').filter(Boolean).map(p => (isAbsolute(p) ? p : join(ROOT, p)))

function main(argv) {
  const arg = name => {
    const at = argv.indexOf(`--${name}`)
    return at === -1 ? undefined : argv[at + 1]
  }
  const slug = arg('slug')
  const subject = arg('subject')
  if (!slug || !subject) throw new Error('usage: --slug <slug> --subject "<subject>" --drafts a,b --verdicts va,vb')
  const today = new Date().toISOString().slice(0, 10)
  const drafts = list(arg('drafts')).flatMap(readJson)
  const verdicts = list(arg('verdicts')).flatMap(readJson)
  const { kept, rejected } = promote(drafts, verdicts, today)

  const setPath = join(ROOT, 'sets', `${slug}.json`)
  const existing = existsSync(setPath) ? readJson(setPath) : { slug, subject, questions: [] }
  const have = new Set(existing.questions.map(q => q.id))
  const set = { ...existing, slug, subject, version: today, questions: [...existing.questions, ...kept.filter(q => !have.has(q.id))] }
  const errors = setErrors(set)
  if (errors.length > 0) throw new Error(`promoted set is invalid:\n  ${errors.join('\n  ')}`)
  writeFileSync(setPath, JSON.stringify(set, null, 2) + '\n')

  const rejectedPath = join(ROOT, 'pending_review', `${slug}-rejected.json`)
  const before = existsSync(rejectedPath) ? readJson(rejectedPath) : []
  writeFileSync(rejectedPath, JSON.stringify([...before, ...rejected], null, 2) + '\n')
  console.log(`kept ${kept.length}, rejected ${rejected.length}; ${setPath} now has ${set.questions.length} questions`)
  for (const r of rejected) console.log(`  ✘ ${r.id}: ${r.reason}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2))
