# quiz-sets

Flash-card question sets for the **quiz-pane** Claude Code mod
([sohosteve/claude-quiz-mod](https://github.com/sohosteve/claude-quiz-mod)). The mod fetches
`index.json` and the files under `sets/` from this repo's raw URL and plays them in a side pane
while Claude works.

## Format

`sets/<slug>.json`:

```json
{
  "slug": "comptia-security-plus-sy0-701",
  "subject": "CompTIA Security+ (SY0-701)",
  "version": "2026-10-28",
  "questions": [
    {
      "id": "secplus-1001",
      "domain": "1.0 General Security Concepts",
      "question": "...",
      "choices": ["...", "...", "...", "...", "..."],
      "answer_index": 2,
      "explanation": "...",
      "sources": [{ "title": "NIST CSRC Glossary: ...", "url": "https://..." }],
      "verified_at": "2026-10-28",
      "verified_by": "quiz-research v1 (blind verify)"
    }
  ]
}
```

Every question needs exactly 5 distinct choices, an `answer_index` of 0-4, at least one https
source, and `verified_at` / `verified_by`. `scripts/validate.mjs` hard-fails otherwise.

## Adding a set

Run the `/quiz-research "<subject or cert>"` skill in Claude Code. It:

1. Maps the subject from the official exam objectives.
2. Drafts questions only from pages it fetched (official docs, NIST, RFCs, OWASP and similar; never exam dumps).
3. Runs a **blind verify** pass: a fresh agent sees the question, the choices and the sources but not
   the answer, and must reach the same answer from the sources alone. Anything else is rejected
   into `pending_review/<slug>-rejected.json` with the reason.
4. Validates, rebuilds `index.json`, commits and pushes.

By hand: write the set, then `npm run validate` (rewrites `index.json`) and `npm test`.

## Content note

Questions are written from public standards and vendor documentation, in original wording.
They are study aids, not official exam content, and are not affiliated with any certifying body.
