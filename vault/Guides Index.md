# Guides Index

Index of study guides — walkthroughs of already-built parts of the system, for onboarding and deep-dive reading. Distinct from [[Specs Index]] (design decisions before and during a build) and [[Plans Index]] (task breakdowns): a guide is written after the fact, for understanding what exists.

## Developer Handbook — start here

- [[Developer Handbook]] — the front door: the system on one page, reading paths by goal, the map of every note, a glossary, and the rule for keeping guides current
- [[Project Briefing]] — plain-English tour of what the product is, what users can do and how the pieces fit
- [[Domain Architecture]] — the four layers (route, service, domain, data) and how one action flows through them
- [[Architecture Review]] — request lifecycle, auth, rate limiting, SSE and data-flow diagrams
- [[Data Model And API Reference]] — every collection and index, every API route, every page
- [[Developer SOP Guide]] — setup, env vars, everyday commands, hooks, the agent pipeline, testing, vault conventions

## Feature guides

- [[Workout Templates Anatomy]] — how workout templates and the `TargetMuscle` anatomy model work across the stack
- [[Network Resilience Learning Record]] — idempotency keys, retries and race conditions: what was learned hardening the app against flaky networks

## Audits and open issues

- [[Architecture Overhaul Audit]] — current system design, data model and defects, each approach weighed on its merits against apartment-system and alternatives neither uses, with the decisions the overhaul needs
- [[Known Issues]] — two open problems found while documenting the code: an unprotected `/templates` page and a cron route that is open when `CRON_SECRET` is unset
