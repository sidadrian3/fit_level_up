# Developer Handbook

The front door to this codebase. Whether you're a developer joining the project, or the owner coming back after a few weeks away, start here: this note says what the system is in one page, which guide to read for whatever you're about to do, how every note in the vault fits together, and how to keep all of it true as the code changes.

This is a map, not the territory. Every section points to a guide that covers its subject properly. Those guides, in turn, point to the design specs that hold the authoritative "why" and to the code that holds the authoritative "what". When a guide and the code disagree, the code wins — and §5 says which note to fix.

---

## 1. The system on one page

**What it is.** FitLevelUp is a gamified fitness tracker. Logging a gym workout or a run earns XP; XP raises your level; daily, weekly and special quests and milestone achievements reward consistency; a daily streak and a stamina meter (overtraining costs XP) shape how you train; friends see each other's levels and records. See [[Project Briefing]].

**What it's made of.** One Next.js 16 App Router application (React 19, TypeScript, Tailwind v4) on MongoDB with Better Auth for email-and-password logins, Upstash Redis for rate limiting, TanStack Query on the client, and Zod for input validation. Tested with Vitest against an in-memory MongoDB replica set, plus Playwright end to end. Targeted at Vercel for hosting. See [[Architecture Overhaul Design Spec]].

**How it's organised.** Every feature flows through four layers: a thin API route, a service that orchestrates one use case, pure domain rules for the game math, and a repository that only talks to MongoDB. The back end is `src/server` (six feature modules plus `platform/`); `src/lib` is browser code only. See [[Domain Architecture]].

**What it stores.** Users with their game state, workouts, runs, workout templates, custom exercises, quest and achievement catalogues with each user's progress, and friendships. Every personal document is scoped by `userId`. See [[Data Model And API Reference]].

**How work gets done here.** Every change goes on a branch, one commit per task, through hooks that lint, typecheck and test before a commit lands — usually driven by the `/feature`, `/fix` and `/refactor` agent pipeline, which leaves a spec, a plan and a history log in this vault. See [[Developer SOP Guide]].

---

## 2. Reading paths — pick yours

| Goal | Read, in order |
|---|---|
| **Onboard** | [[Project Briefing]] → [[Developer SOP Guide]] §1–§4 → [[Domain Architecture]] → [[Architecture Overhaul Design Spec]] |
| **Backend feature or fix** | [[Domain Architecture]] → [[Data Model And API Reference]] §2–§4 → the feature's design spec → [[Developer SOP Guide]] §9 |
| **Frontend feature or fix** | [[UI Overhaul Design Spec]] → [[Data Model And API Reference]] §5 → `AGENTS.md` (Styling, React Query) |
| **Schema change** | [[Data Model And API Reference]] §2–§3 → [[Developer SOP Guide]] §8 |
| **Auth, security, rate limits** | [[Architecture Overhaul Design Spec]] → [[Data Model And API Reference]] §4 → `AGENTS.md` (MongoDB & Data Integrity) |
| **Retries, duplicates, races** | [[Network Resilience Learning Record]] → [[Domain Architecture]] |
| **Workout templates and muscles** | [[Workout Templates Anatomy]] → [[Workout Templates Design Spec]] → [[Human Anatomy UI Design Spec]] |
| **Deployment** | [[Vercel Deployment Design Spec]] → [[Developer SOP Guide]] §3 |
| **Working with the agent pipeline** | [[Developer SOP Guide]] §5–§6 → [[Agent Workflow Design Spec]] |

---

## 3. The map of everything

Three layers, each answering a different question:

| Layer | Answers | Notes |
|---|---|---|
| **Handbook** (this note + 2) | "How does the whole thing work?" | [[Data Model And API Reference]] · [[Developer SOP Guide]] |
| **Guides** | "How does *this part* work, and why?" | [[Project Briefing]] · [[Domain Architecture]] · [[Workout Templates Anatomy]] · [[Network Resilience Learning Record]] — all listed in [[Guides Index]] |
| **Decision records** | "What exactly was decided, and what happened building it?" | [[Specs Index]] (design specs — the authoritative "why"), [[Plans Index]] (task-by-task build orders), [[History Index]] (every pipeline run, tagged by area), `reference/` (pre-vault context, frozen) |

---

## 4. Glossary

| Term | Meaning | More in |
|---|---|---|
| **XP / level** | Points earned per activity; each level needs `level × 500` XP | [[Project Briefing]] |
| **Streak** | Consecutive days with at least one activity; it resets if a day is skipped | [[Project Briefing]] |
| **Stamina** | A meter that regenerates over time; training while depleted earns reduced XP | [[Project Briefing]] |
| **Quest** | A period-bound goal (daily, weekly, special) on a metric — workout count, run count, run distance — with an XP reward the user claims | [[Domain Architecture]] |
| **Achievement** | A permanent milestone badge with a rarity, unlocked by totals, level or streak | [[Domain Architecture]] |
| **TargetMuscle** | The enumeration of muscle groups an exercise trains; drives the anatomy model and heatmap | [[Workout Templates Anatomy]] |
| **Idempotency key** | A client-generated id sent with a create so a retried request is recognised as the same one | [[Network Resilience Learning Record]] |
| **Service / domain / data layer** | Orchestration / pure rules / MongoDB access | [[Domain Architecture]] |
| **Inbox** | The `notifications` collection: per-user entries for friend requests, accepts, friend level-ups and achievement unlocks, polled by the browser | [[Data Model And API Reference]] §6 |
| **Brain scan** | The first step of every pipeline: search this vault for prior decisions before reading code | [[Agent Workflow Design Spec]] |

---

## 5. Keeping this handbook current

The guides drift when nothing says who updates what. This table is that rule, and since [[Handbook Sync Step Design Spec]] it's also an executed pipeline step — Step 7c in `feature` (6b in standalone `fix`, 5b in standalone `refactor`) applies this table to the diff automatically, before code review. When a change lands, update the listed note **in the same branch**:

| When you… | Update |
|---|---|
| Add, remove or change an API route, its auth or its rate limit | [[Data Model And API Reference]] §4 |
| Add or change a collection, field, enum or index | [[Data Model And API Reference]] §2–§3 |
| Add a page or change the navigation | [[Data Model And API Reference]] §5 |
| Add a service, a domain rule or change how the layers call each other | [[Domain Architecture]] |
| Add a script, env var, hook, command or port | [[Developer SOP Guide]] |
| Change infrastructure, the auth flow, rate limiting or another cross-cutting rule | [[Architecture Overhaul Design Spec]] |
| Change a game rule or a user-visible behaviour (XP, streaks, stamina, quests, achievements) | [[Project Briefing]] |
| Change workout templates or the muscle model | [[Workout Templates Anatomy]] |
| Find a guide claim the code contradicts | Rewrite it in place so the guide states what is true now, in the present tense |
| Add a new guide | [[Guides Index]] + §3 above |

A guide states what is true now. Rewrite a stale claim in place, in the present tense, with no strikethrough, dated "Corrected" marker or "added later" label — git and the history notes record what changed. The reason for the current design stays; a decision that was reversed leaves the guide and stays in its spec.

---

## 6. Notes to treat with care

- **[[Workout Templates Anatomy]]**, **[[Project Briefing]]** and **[[Domain Architecture]]** were written in July 2026, before the vault existed. They are mostly accurate but have not been re-verified line by line against the code; treat the code as the authority and fix a guide when you find it wrong.
- **[[Architecture Review]]** is superseded by [[Architecture Overhaul Design Spec]]. It describes the pre-overhaul system (SSE, `lib/services`, per-route error handling) and is kept for its reasoning; do not use it as a description of the code.
- **[[Network Resilience Learning Record]]** is a snapshot of what was learned at one moment; it is not kept current.
- **[[Known Issues]]** lists open problems that are documented but not fixed; the guides describe the code as it is, including these.
- `reference/` is **frozen on purpose**: newer decisions override it; never edit it to match.

---

## Related notes

- [[Guides Index]]
- [[Specs Index]] · [[Plans Index]] · [[History Index]]
- [[README]] — the vault's own conventions
