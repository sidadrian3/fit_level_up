# Handbook Sync Step Design Spec

**Type:** workflow (infra/meta) · **Touches:** [[Agent Workflow Design Spec]] (tracked, changed first), the generated `feature` / `fix` / `refactor` / `code-review` skills (gitignored under `.agents/skills/`), [[Developer Handbook]] §5 and [[Developer SOP Guide]] §5 · **Lane:** full

**Status:** Carried over from apartment-system, where it was approved after a brainstorm and grilling pass, and adapted to this repo's notes.

The sync edits a guide in place to state what is true now (see [[Agent Workflow Design Spec]], Handbook Sync and decision 16).

---

## 1. Problem

[[Developer Handbook]] §5 says which note to update for each kind of change, but nothing in the pipelines would run it. Guides drift for exactly that reason — no step owns "the docs now describe the code". The handbook drifts the same way unless a pipeline step does the update.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| 1 | A new **Handbook sync** step in every non-contained pipeline run, including the small-change lane | The rule has to be executed, not remembered |
| 2 | It runs **after verification, before code review** — feature Step **7c**; fix Step **6b** (standalone); refactor Step **5b** (standalone) | Before review, so the Standards reviewer sees the doc edits; lettered sub-steps so no existing step number changes |
| 3 | Fix and refactor run it **standalone only** — skipped in Contained Mode (feature has no Contained Mode) | The parent feature's own 7c covers the interrupt's changes |
| 4 | The **coordinator** runs it in-context, never a sub-agent | One short diff-driven docs pass; the coordinator already holds the change |
| 5 | Decision gate **A** (user implements) adds the step to `task.md` as a checklist item — in feature, and in standalone fix and refactor | The pipeline stops at `task.md`, so the step would otherwise vanish |
| 6 | New `REPO_REVIEW_CHECKLIST` item, judgement call: **Docs drift** | Backstop for anything the step missed |
| 7 | History log gains a `Handbook:` line under Verification | The brain scan can see what was updated, or why nothing was |

## 3. The step

```
Step 7c · Handbook sync   (fix: 6b · refactor: 5b · standalone / non-contained only)
  1. git diff --name-only <base-commit>..HEAD
  2. Map each change through Developer Handbook §5:
       API route / auth / rate limit          → Data Model And API Reference §4
       collection / field / enum / index      → Data Model And API Reference §2–§3
       page / navigation                      → Data Model And API Reference §5
       service / domain rule / layering       → Domain Architecture
       script / env var / hook / command      → Developer SOP Guide
       infra / auth flow / SSE / rate limits  → Architecture Review
       game rule or user-visible behaviour    → Project Briefing
       templates / muscle model               → Workout Templates Anatomy
       new guide                              → Guides Index + Developer Handbook §3
  3. Update those notes to match the code. Where the change made a guide claim untrue,
     rewrite the claim in place in the present tense — no strikethrough, no dated
     "Corrected" marker, no "added later" label.
  4. Commit "docs(vault): update handbook for <name>"
     — or output "Handbook: no update needed — <why>" and commit nothing.
```

Vault-only changes output `Handbook: no update needed — docs-only change` unless they themselves contradict a handbook note.

## 4. Review checklist item

Added to `REPO_REVIEW_CHECKLIST` as its own group:

> **Docs — judgement calls:** a handbook or guide claim this diff makes untrue, or a Developer Handbook §5 mapping the diff triggered but didn't update.

## 5. History log format

Under `## Verification`, after `UI verified:`:

```
Handbook: <notes updated, comma-separated, or "none needed — <why>">
```

## 6. Out of scope

- Retroactive handbook sync for past runs.
- Automating the mapping in a hook or script.

[[Specs Index]]
