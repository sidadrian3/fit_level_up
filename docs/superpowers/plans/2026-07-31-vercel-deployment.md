# Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the application fails fast if Redis vars are missing, and handles SSE dropouts gracefully in the UI.

**Architecture:** We will add Zod schemas to `src/env.ts` for Upstash variables, and add a simple boolean state to `useFriendEvents` that activates a Lucide `Loader2` spinner on the Friends page.

**Tech Stack:** Next.js, Zod, Lucide React, Server-Sent Events

## Global Constraints

- Must run properly on Vercel Hobby plan.
- The UI spinner must be subtle and not block the user.
- Seeding Atlas is an operational step outside this codebase modification.

---

### Task 1: Enforce Upstash Redis Variables

**Files:**
- Modify: `src/env.ts`

- [ ] **Step 1: Add validation to env.ts**

Update `src/env.ts` to include `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` as required strings in the `server` block.

```typescript
        UPSTASH_REDIS_URL: z.string().url(),
        UPSTASH_REDIS_TOKEN: z.string().min(1),
```

- [ ] **Step 2: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/env.ts
git commit -m "chore: enforce upstash redis env variables at build time"
```

---

### Task 2: Add Reconnecting State to SSE Hook

**Files:**
- Modify: `src/lib/hooks/useFriendEvents.ts`

**Interfaces:**
- Produces: `isReconnecting: boolean` returned from the hook.

- [ ] **Step 1: Add state to hook**

Update `src/lib/hooks/useFriendEvents.ts` to add an `isReconnecting` state. Set it to `false` initially and inside `es.onopen` or on the first message, and set it to `true` inside `es.onerror`.

```typescript
  const [activeEvent, setActiveEvent] = useState<SSEEvent | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/friends/events");

    es.onopen = () => {
      setIsReconnecting(false);
    };

    es.onmessage = (e) => {
      setIsReconnecting(false);
      // ... existing switch statement ...
    };

    es.onerror = () => {
      console.warn("[SSE] Connection error, reconnecting...");
      setIsReconnecting(true);
    };

    return () => es.close();
  }, [queryClient]);

  const clearEvent = () => setActiveEvent(null);

  return { activeEvent, clearEvent, isReconnecting };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/useFriendEvents.ts
git commit -m "feat: expose isReconnecting state for SSE connection drops"
```

---

### Task 3: Show Reconnecting UI on Friends Page

**Files:**
- Modify: `src/app/(app)/friends/page.tsx`

**Interfaces:**
- Consumes: `isReconnecting` from `useFriendEvents`.

- [ ] **Step 1: Import and hook into UI**

Import `useFriendEvents` and use it in `FriendsPage`. Add a small indicator next to the `PageHeader`.

```tsx
// Imports:
import { useFriendEvents } from "@/lib/hooks/useFriendEvents";
import { Loader2 } from "lucide-react";

// Inside component:
export default function FriendsPage() {
  const { isReconnecting } = useFriendEvents();
  // ... existing code ...

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <PageHeader title="Friends" subtitle="Compete and train with your squad." />
        {isReconnecting && (
          <div className="flex items-center gap-2 text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Reconnecting feed...</span>
          </div>
        )}
      </div>
```

- [ ] **Step 2: Run linter/tsc**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/friends/page.tsx
git commit -m "feat: show non-intrusive spinner when SSE reconnects"
```
