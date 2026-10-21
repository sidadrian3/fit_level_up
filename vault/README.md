# FitLevelUp — Knowledge Vault

This is the second brain / Obsidian vault for **FitLevelUp**, a gamified fitness tracker (workouts and runs earn XP, levels, quests and achievements).

## Start Here

- [[Developer Handbook]] — the front door: the system on one page, reading paths by goal, the map of every note, and the rule for keeping the guides current
- [[Specs Index]] — all design specs (features, UI direction, deployment, agent workflow)
- [[Plans Index]] — all implementation plans
- [[History Index]] — completed agentic-workflow pipeline runs
- [[Guides Index]] — study guides for already-built parts of the system
- `reference/` — pre-onboarding context and session notes (not wikilinked — see below)

## Structure

- **Root notes** — mostly flat. Use `[[wikilinks]]` and index notes for navigation.
- **`specs/`, `plans/`, `history/`** — decision records, each with its own index note. `specs/infra-meta/` holds the notes about the agent workflow itself.
- **`reference/`** — pre-onboarding project context (briefs, notes, hand-off files). Drop `.md` files here.
- **`attachments/`** — images and other embedded files.

## Naming Conventions

- **Index notes** aggregate related topics (`Guides Index.md`, `Specs Index.md`)
- **Title Case** for all note names, no date prefixes
- No deep folder nesting — use links and index notes instead

## Linking

- Use Obsidian `[[wikilinks]]` syntax: `[[Note Title]]`
- Notes link to dependencies/related notes at the bottom
- Index notes are just lists of `[[wikilinks]]`
- `node scripts/check-vault.mjs` verifies that every wikilink resolves and that no guide carries a strikethrough or "Corrected" marker
