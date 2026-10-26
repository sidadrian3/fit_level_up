# Workout Templates & Human Anatomy Architecture

This document details how the **Workout Templates** and **Human Anatomy** features are implemented across the stack.

---

## 1. Human Anatomy (`TargetMuscle`)

In this application, "Human Anatomy" is modeled as a strict enumeration called `TargetMuscle`. It dictates which muscle group a specific exercise is targeting.

### Where it lives:
This is defined in the shared contracts (`src/shared/contracts/exercise.ts`) so both the frontend and backend strictly adhere to the same anatomical definitions.

**Code Snippet (`src/shared/contracts/exercise.ts`):**
```typescript
export enum TargetMuscle {
    Chest = "Chest",
    Back = "Back",
    Legs = "Legs",
    Arms = "Arms",
    Core = "Core",
    Cardio = "Cardio",
    FullBody = "Full Body"
}

export interface Exercise {
    name: string;
    targetMuscle: TargetMuscle; // Enforces the anatomy tag
    sets: number;
    reps: number;
    weight: number | null; 
}
```

By keeping it as an enum, the application avoids typos in the database (e.g., someone typing "leg" vs "Legs") and allows the UI to reliably filter or aggregate stats based on anatomical groups later.

---

## 2. Workout Templates (The Bypass Flow)

A Workout Template is a saved blueprint of exercises (with their anatomy tags) that a user can quickly load later. 

Unlike logging a *real* workout—which requires heavy math for Stamina costs, XP gains, and triggering side effects (Quests, Achievements)—saving a template does **none of those things**. Because of this, the architecture intentionally bypasses the Service and Domain layers for simplicity.

### 🏗️ Visual Flow (Template Creation)

```text
[ Client UI ] (CreateTemplateForm.tsx)
   │
   │ (1) User fills name & exercises (with TargetMuscle)
   │ (2) POST /api/workout-templates
   ▼
[ API Layer ] (route.ts)
   │ - Authenticates User
   │ - Validates payload matches schemas
   │
   │ (3) createWorkoutTemplateInDb()
   ▼
[ Data Layer ] (workout-templates-db.ts)
   │ - Inserts directly into MongoDB
   │ ◄─ Returns newly created template ID
   │
   ▼
[ API Layer ]
   │
   │ (4) Returns 201 Created
   ▼
[ Client UI ]
```

### 💻 Code Snippets across the Stack

**1. The Client UI (`src/app/(app)/templates/new/_components/CreateTemplateForm.tsx`)**
The user builds the template. Notice how the payload directly bundles the exercises.
```tsx
const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const namedExercises = exercises.filter(ex => ex.name.trim());
    
    // Sends the payload to the API
    await createWorkoutTemplate({
        name: name.trim(),
        exercises: namedExercises,
        idempotencyKey: crypto.randomUUID()
    });
    // ...
};
```

**2. The API Layer (`src/app/api/workout-templates/route.ts`)**
The API validates the request, and instantly passes it to the Data Layer.
```typescript
export async function POST(req: Request) {
    try {
        const userId = await getAuthUserId();
        const body = await req.json();
        
        // Ensure the payload is structurally valid
        const input = WorkoutTemplateSchema.parse(body);

        // BYPASS: Jump straight to the database layer!
        const template = await createWorkoutTemplateInDb({
            userId,
            name: input.name,
            exercises: input.exercises, // Includes the TargetMuscle anatomy data
            idempotencyKey: input.idempotencyKey,
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json(template, {status: 201});
    } catch(err) {
        return handleApiError(err);
    }
}
```

**3. The Data Layer (`src/server/training/templates/template.repository.ts`)**
Receives the validated object and saves it as a document in MongoDB through a user-scoped repository, which stamps the `userId` on the insert.
```typescript
const templates = userScopedRepository<OwnedTemplateDoc>("workoutTemplates");

export async function insertTemplate(input: Omit<WorkoutTemplateDoc, "_id">): Promise<WorkoutTemplate> {
    const { userId, ...rest } = input;
    return toWorkoutTemplate(await templates.insertOne(userId, rest));
}
```

---

## 3. How they combine (The Real Workout)

When a user clicks on a template they saved earlier:
1. The UI fetches the Template from the API.
2. It takes the `exercises` array (and all the associated `TargetMuscle` anatomy data).
3. It drops them into the standard **Workout Form**.
4. When the user clicks "Finish Workout", it goes through the full, complex `Client -> API -> Service -> Domain -> Data` flow, utilizing the math in `workout-evaluator.ts` to calculate Stamina drain and XP gain. 
