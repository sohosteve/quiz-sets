#!/usr/bin/env node
// Validates every quiz set under sets/ and rewrites index.json from them.
// Hard-fails on any question missing sources, provenance, or 5 distinct choices,
// so unverified content cannot enter the live pool.
//   node scripts/validate.mjs            validate sets/ and write index.json
//   node scripts/validate.mjs --check    validate only (CI)
//   node scripts/validate.mjs <file...>  validate the named files only
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CHOICES = 5
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const isText = v => typeof v === 'string' && v.trim().length > 0
const isHttps = v => {
  try {
    return isText(v) && new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

export function questionErrors(q) {
  if (typeof q !== 'object' || q === null) return ['question is not an object']
  const at = `question ${q.id ?? '(no id)'}`
  const errors = []
  if (!isText(q.id)) errors.push(`${at}: missing id`)
  if (!isText(q.question)) errors.push(`${at}: missing question text`)
  if (!Array.isArray(q.choices) || q.choices.length !== CHOICES || !q.choices.every(isText)) {
    errors.push(`${at}: needs exactly ${CHOICES} non-empty choices`)
  } else if (new Set(q.choices.map(c => c.trim().toLowerCase())).size !== CHOICES) {
    errors.push(`${at}: duplicate choices`)
  }
  if (!Number.isInteger(q.answer_index) || q.answer_index < 0 || q.answer_index >= CHOICES) {
    errors.push(`${at}: answer_index must be 0-${CHOICES - 1}`)
  }
  if (!isText(q.explanation)) errors.push(`${at}: missing explanation`)
  if (!Array.isArray(q.sources) || q.sources.length === 0) {
    errors.push(`${at}: needs at least one source`)
  } else if (!q.sources.every(s => isText(s?.title) && isHttps(s?.url))) {
    errors.push(`${at}: each source needs a title and an https url`)
  }
  if (!isText(q.verified_at) || !isText(q.verified_by)) errors.push(`${at}: missing verified_at / verified_by`)
  return errors
}

export function setErrors(set) {
  if (typeof set !== 'object' || set === null) return ['set is not an object']
  const errors = []
  if (!isText(set.slug) || !SLUG.test(set.slug)) errors.push('set needs a lowercase slug')
  if (!isText(set.subject) || !isText(set.version)) errors.push('set needs subject and version')
  if (!Array.isArray(set.questions) || set.questions.length === 0) return [...errors, 'set has no questions']
  const seen = new Set()
  for (const q of set.questions) {
    errors.push(...questionErrors(q))
    if (!isText(q?.id)) continue
    if (seen.has(q.id)) errors.push(`duplicate question id ${q.id}`)
    seen.add(q.id)
  }
  return errors
}

function main(argv) {
  const isCheck = argv.includes('--check')
  const named = argv.filter(a => !a.startsWith('--'))
  const files = named.length > 0 ? named : readdirSync(join(ROOT, 'sets')).filter(f => f.endsWith('.json')).map(f => join(ROOT, 'sets', f))
  const entries = []
  let failed = false
  for (const file of files) {
    let set
    try {
      set = JSON.parse(readFileSync(file, 'utf8'))
    } catch (err) {
      console.error(`✘ ${file}: ${err.message}`)
      failed = true
      continue
    }
    const errors = setErrors(set)
    if (named.length === 0 && set.slug !== basename(file, '.json')) errors.push(`slug "${set.slug}" must match file name`)
    if (errors.length > 0) {
      failed = true
      console.error(`✘ ${file}\n  ${errors.join('\n  ')}`)
      continue
    }
    console.log(`✔ ${relative(ROOT, file)}: ${set.questions.length} questions`)
    entries.push({ slug: set.slug, subject: set.subject, version: set.version, path: `sets/${set.slug}.json`, count: set.questions.length })
  }
  if (failed) process.exit(1)
  if (!isCheck && named.length === 0) {
    const index = { generated_at: new Date().toISOString().slice(0, 10), sets: entries.sort((a, b) => a.slug.localeCompare(b.slug)) }
    writeFileSync(join(ROOT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
    console.log(`index.json: ${entries.length} sets`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2))
