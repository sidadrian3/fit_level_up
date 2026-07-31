## Problem Statement

When deploying Fit Level Up to Vercel (especially on Hobby plans), there are several environmental and architectural gotchas. Specifically, missing Upstash Redis variables in `env.ts` will only cause runtime errors instead of failing the build. Furthermore, Vercel kills serverless functions after 60 seconds, which abruptly closes Server-Sent Events (SSE). The native browser `EventSource` attempts to reconnect, but currently, the UI offers no visual indication to the user that their live feed is temporarily down and reconnecting. 

## Solution

1. Add `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` to `src/env.ts` using Zod to enforce their presence at build time.
2. Expose an `isReconnecting` state from the `useFriendEvents` hook.
3. Display a subtle, non-intrusive loading spinner next to the "Friends" section/title in the UI when `isReconnecting` is true, ensuring users know the feed is refreshing without blocking their experience.
4. Establish that database seeding is a manual, one-time execution against the production URI locally (no code changes needed).

## User Stories

1. As a developer deploying to Vercel, I want the build to fail fast if I forget my Upstash Redis environment variables, so that I don't discover crashes at runtime.
2. As a user viewing the Friends page, I want a subtle visual indicator when my live activity feed connection drops and is reconnecting, so that I know why new events might be temporarily delayed.
3. As a developer, I want to safely seed my production database without exposing a public admin API route, so that my production environment remains secure.

## Implementation Decisions

- **Environment Validation:** `src/env.ts` will be updated to include `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` in the `server` configuration. This relies on the `@t3-oss/env-nextjs` package already in use.
- **SSE Hook Modification:** `useFriendEvents` will track an `isReconnecting` boolean state. It will be set to `true` inside `es.onerror` and reset to `false` inside `es.onopen` or when a message is successfully received.
- **UI Placement:** The reconnecting spinner will be placed in `src/app/(app)/friends/page.tsx` next to the PageHeader title, using a small `Loader2` from `lucide-react`.
- **Seeding:** Confirmed that running `npm run seed` locally with a modified `.env.local` pointing to the production Atlas URI is the official path forward. No new seeding code is required.

## Testing Decisions

- **Manual Testing of Env Validation:** Temporarily removing `UPSTASH_REDIS_URL` from `.env.local` and running `npm run build` should result in an immediate Zod validation error.
- **Manual Testing of SSE Reconnect UI:** The developer can test this locally by stopping the Next.js server while the browser is open on the Friends page. The subtle spinner should appear as `EventSource` enters the error state. When the server restarts, the spinner should disappear.

## Out of Scope

- Building a dedicated admin dashboard or API route for database seeding.
- Migrating from Server-Sent Events to WebSockets (Pusher/Socket.io). We are keeping SSE.

## Further Notes
- Vercel hobby limits are a known constraint; the subtle UI spinner is a "graceful degradation" pattern that avoids rewriting the real-time infrastructure.
