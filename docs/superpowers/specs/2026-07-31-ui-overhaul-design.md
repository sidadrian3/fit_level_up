## Problem Statement

The current front-end UI for Fit Level Up relies heavily on generic "vibe-coded" Tailwind utilities (like slow, floaty `hover-lift` animations and generic glass panels). It lacks a unique, cohesive identity that balances the "gaming/RPG" feel with a premium fitness tracking experience. The typography and component physics feel disjointed from the core product vision.

## Solution

We will implement a "Modern Athletic" design overhaul. This replaces generic SaaS styles with a high-contrast, tactile, and gamified aesthetic. We will switch to OLED blacks, tight layout density, structured typography (Barlow Condensed + Barlow), and native-feeling spring-physics for interactions (active press states instead of floaty hovers).

## User Stories

1. As a fitness user, I want the app to feel snappy and responsive to my touch, so that navigating my workout stats feels like using a premium piece of hardware or high-end game.
2. As a user tracking my fitness streaks, I want the data to look intense and athletic, so that I feel motivated to push my limits.
3. As a developer, I want a cohesive set of Tailwind variables and utilities, so that I stop writing "vibe-code" and can reliably build new pages that look on-brand.

## Implementation Decisions

- **Art Direction:** "Modern Athletic" (Apple Fitness + Gaming).
- **Typography:** Barlow Condensed (for display/stats) and Barlow (for body text).
- **Colors:** OLED Black background (`#000000`). Flat dark surfaces for cards (`#111111`) with sharp 1px borders (`border-white/10`). Lime Green (`#d1ff1a`) remains the primary accent.
- **Motion:** Replace `hover-lift` (translate Y and shadow over 300ms) with an `active-press` utility (`scale-95` and border highlight over 100ms) to mimic physical buttons.
- **Density:** Tighten spacing arrays globally to give the app a more data-rich, HUD-like feel.
- **Modules modified:** 
  - `src/app/globals.css` (Base tokens and utilities)
  - `src/components/ui/*` (Core primitives like Button and Card)
  - `src/app/(landing)/page.tsx` (Homepage facelift)

## Testing Decisions

- A visual QA pass is required across all modified components.
- The UI must remain fully accessible (contrast ratios of text against the new flat dark backgrounds).
- Standard unit tests (`vitest`) should not be affected since this is a pure CSS/component styling refactor.

## Out of Scope

- Refactoring the entire routing or data-fetching logic.
- Adding new pages or features (only restyling existing ones).
- Changing the primary brand logo.

## Further Notes

This spec establishes the new visual baseline. Future features will inherit these tight, high-contrast primitives.
