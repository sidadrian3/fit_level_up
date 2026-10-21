# Seal Data Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract workout template creation logic into a deep service module to seal the data bypass in the API route.

**Architecture:** Create a new service function `createWorkoutTemplate` that sits between the API adapter and the Database adapter. The service owns the timestamp generation and payload construction. The API route simply parses the Zod schema and calls the service.

**Tech Stack:** Next.js, TypeScript, Zod, Vitest

## Global Constraints
- Must maintain 100% test pass rate in `vitest`.
- Must not alter the existing database schema or data shapes.
- Use explicit types and no `any`.

---

### Task 1: Create the Workout Template Service

**Files:**
- Create: `src/lib/services/workout-templates/create-workout-template.ts`
- Create: `src/lib/services/__tests__/create-workout-template.test.ts`

**Interfaces:**
- Consumes: `createWorkoutTemplateInDb` from `src/lib/data/workout-templates-db`
- Consumes: `WorkoutTemplateSchema` types from `src/lib/validations/schemas`
- Produces: `createWorkoutTemplate(input: z.infer<typeof WorkoutTemplateSchema>, userId: string)`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/create-workout-template.test.ts
import { describe, it, expect, vi } from "vitest";
import { createWorkoutTemplate } from "../workout-templates/create-workout-template";
import * as workoutTemplatesDb from "@/lib/data/workout-templates-db";
import { TargetMuscle } from "@/lib/types";

vi.mock("@/lib/data/workout-templates-db", () => ({
    createWorkoutTemplateInDb: vi.fn(),
}));

describe("createWorkoutTemplate Service", () => {
    it("should generate a createdAt timestamp and delegate to the DB adapter", async () => {
        const mockInput = {
            name: "Upper Body Power",
            idempotencyKey: "test-idemp-123",
            exercises: [
                {
                    name: "Bench Press",
                    targetMuscle: TargetMuscle.Chest,
                    sets: [{ reps: 5, weight: 225 }]
                }
            ]
        };
        const userId = "test-user-123";

        // Mock DB return
        vi.mocked(workoutTemplatesDb.createWorkoutTemplateInDb).mockResolvedValue({
            id: "fake-id",
            userId,
            ...mockInput,
            createdAt: new Date().toISOString()
        });

        const result = await createWorkoutTemplate(mockInput, userId);

        expect(workoutTemplatesDb.createWorkoutTemplateInDb).toHaveBeenCalledTimes(1);
        
        const callArgs = vi.mocked(workoutTemplatesDb.createWorkoutTemplateInDb).mock.calls[0][0];
        expect(callArgs.userId).toBe(userId);
        expect(callArgs.name).toBe("Upper Body Power");
        expect(callArgs.idempotencyKey).toBe("test-idemp-123");
        expect(callArgs.createdAt).toBeDefined();
        
        expect(result.name).toBe("Upper Body Power");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/create-workout-template.test.ts`
Expected: FAIL with "Cannot resolve module" or "createWorkoutTemplate is not a function"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/services/workout-templates/create-workout-template.ts
import { WorkoutTemplateSchema } from "@/lib/validations/schemas";
import { createWorkoutTemplateInDb } from "@/lib/data/workout-templates-db";
import { z } from "zod";
import type { WorkoutTemplate } from "@/lib/types";

export async function createWorkoutTemplate(
    input: z.infer<typeof WorkoutTemplateSchema>, 
    userId: string
): Promise<WorkoutTemplate> {
    const template = await createWorkoutTemplateInDb({
        userId,
        name: input.name,
        exercises: input.exercises,
        idempotencyKey: input.idempotencyKey,
        createdAt: new Date().toISOString(),
    });

    return template;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/create-workout-template.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/workout-templates/create-workout-template.ts src/lib/services/__tests__/create-workout-template.test.ts
git commit -m "feat(services): extract createWorkoutTemplate deep module"
```

---

### Task 2: Refactor API Route to use the Deep Service

**Files:**
- Modify: `src/app/api/workout-templates/route.ts`

**Interfaces:**
- Consumes: `createWorkoutTemplate` from `src/lib/services/workout-templates/create-workout-template`
- Produces: HTTP 201 Response

- [ ] **Step 1: Write the minimal implementation**

```typescript
// src/app/api/workout-templates/route.ts
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";
import { WorkoutTemplateSchema } from "@/lib/validations/schemas";
import { getWorkoutTemplatesFromDb } from "@/lib/data/workout-templates-db";
import { createWorkoutTemplate } from "@/lib/services/workout-templates/create-workout-template";

export async function GET(){
    try{
        const userId = await getAuthUserId();
        const templates = await getWorkoutTemplatesFromDb(userId);
        return NextResponse.json(templates);
    }catch (err){
        return handleApiError(err);
    }
}

export async function POST(req: Request){
    try{
        const userId = await getAuthUserId();
        const body = await req.json();
        const input = WorkoutTemplateSchema.parse(body);

        const template = await createWorkoutTemplate(input, userId);

        return NextResponse.json(template, {status: 201});
    }catch(err){
        return handleApiError(err);
    }
}
```

- [ ] **Step 2: Run all tests to ensure no regressions**

Run: `npx vitest run`
Expected: PASS (all tests green)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/workout-templates/route.ts
git commit -m "refactor(api): seal data bypass in workout templates route"
```
