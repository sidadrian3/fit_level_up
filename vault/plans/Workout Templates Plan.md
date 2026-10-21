# Workout Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frictionless way for users to create, manage, and use Workout Templates to pre-fill their workout logs.

**Architecture:** We will create a new MongoDB collection for templates, a service layer for CRUD, REST API endpoints, and two main frontend components: a template builder and a template selector modal in the workout form.

**Tech Stack:** Next.js 16 App Router, MongoDB, TanStack Query, Tailwind CSS, Zod.

## Global Constraints
- All database access must go through the data layer (`src/lib/data/`).
- API routes must use the centralized `handleApiError` utility.
- All new mutations must use an `idempotencyKey` to prevent duplicates.
- All components must use Tailwind CSS for styling.

---

### Task 1: Domain Types and Zod Schemas

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/validations/schemas.ts`

**Interfaces:**
- Produces: `WorkoutTemplate`, `CreateWorkoutTemplateInput`, `WorkoutTemplateSchema`

- [ ] **Step 1: Add types to `src/lib/types.ts`**
```typescript
export interface WorkoutTemplate {
    id: string;
    userId: string;
    name: string;
    exercises: Exercise[];
    createdAt: DateString;
}

export type CreateWorkoutTemplateInput = {
    name: string;
    exercises: Exercise[];
    idempotencyKey: string;
}
```

- [ ] **Step 2: Add Zod schemas to `src/lib/validations/schemas.ts`**
```typescript
export const WorkoutTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  exercises: z.array(ExerciseSchema).min(1, "At least one exercise is required"),
  idempotencyKey: z.string().uuid("Invalid idempotency key")
});
```

### Task 2: Data Layer (MongoDB CRUD)

**Files:**
- Create: `src/lib/data/workout-templates-db.ts`
- Create: `src/lib/data/__tests__/workout-templates-db.test.ts`

**Interfaces:**
- Produces: `getWorkoutTemplatesFromDb`, `createWorkoutTemplateInDb`, `deleteWorkoutTemplateFromDb`

- [ ] **Step 1: Implement `src/lib/data/workout-templates-db.ts`**
```typescript
import { Collection, ObjectId } from "mongodb";
import { getCollection } from "../mongodb";
import { WorkoutTemplate } from "../types";

export interface WorkoutTemplateMongoDoc {
  _id?: ObjectId;
  userId: string;
  name: string;
  exercises: any[];
  idempotencyKey: string;
  createdAt: string;
}

export async function getWorkoutTemplatesFromDb(userId: string): Promise<WorkoutTemplate[]> {
  const col = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
  const docs = await col.find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id!.toString(),
    userId: doc.userId,
    name: doc.name,
    exercises: doc.exercises,
    createdAt: doc.createdAt
  }));
}

export async function createWorkoutTemplateInDb(input: Omit<WorkoutTemplateMongoDoc, "_id">): Promise<WorkoutTemplate> {
  const col = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
  
  // Idempotency check
  const existing = await col.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey });
  if (existing) {
    return {
      id: existing._id!.toString(),
      userId: existing.userId,
      name: existing.name,
      exercises: existing.exercises,
      createdAt: existing.createdAt
    };
  }

  const result = await col.insertOne(input);
  return {
    id: result.insertedId.toString(),
    userId: input.userId,
    name: input.name,
    exercises: input.exercises,
    createdAt: input.createdAt
  };
}

export async function deleteWorkoutTemplateFromDb(userId: string, templateId: string): Promise<boolean> {
  const col = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
  const result = await col.deleteOne({ _id: new ObjectId(templateId), userId });
  return result.deletedCount === 1;
}
```

### Task 3: Services and API Routes

**Files:**
- Create: `src/app/api/workout-templates/route.ts`
- Create: `src/app/api/workout-templates/[id]/route.ts`
- Modify: `src/lib/data/ensure-indexes.ts`

**Interfaces:**
- Produces: `GET /api/workout-templates`, `POST /api/workout-templates`, `DELETE /api/workout-templates/[id]`

- [ ] **Step 1: Ensure indexes in `src/lib/data/ensure-indexes.ts`**
Modify `ensureIndexes()` to add:
```typescript
  const templatesCol = await getCollection("workoutTemplatesCollection");
  await templatesCol.createIndex({ userId: 1 });
  await templatesCol.createIndex(
    { userId: 1, idempotencyKey: 1 },
    { unique: true }
  );
```

- [ ] **Step 2: Implement `src/app/api/workout-templates/route.ts`**
```typescript
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";
import { WorkoutTemplateSchema } from "@/lib/validations/schemas";
import { getWorkoutTemplatesFromDb, createWorkoutTemplateInDb } from "@/lib/data/workout-templates-db";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const templates = await getWorkoutTemplatesFromDb(userId);
    return NextResponse.json(templates);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId();
    const body = await req.json();
    const input = WorkoutTemplateSchema.parse(body);
    
    const template = await createWorkoutTemplateInDb({
      userId,
      name: input.name,
      exercises: input.exercises,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString()
    });
    
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 3: Implement `src/app/api/workout-templates/[id]/route.ts`**
```typescript
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";
import { deleteWorkoutTemplateFromDb } from "@/lib/data/workout-templates-db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    const { id } = await params;
    
    const deleted = await deleteWorkoutTemplateFromDb(userId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
```

### Task 4: Frontend API Client

**Files:**
- Create: `src/lib/data/api-client/workout-templates.ts`
- Modify: `src/lib/data/api-client/index.ts`

- [ ] **Step 1: Implement `src/lib/data/api-client/workout-templates.ts`**
```typescript
import { WorkoutTemplate, CreateWorkoutTemplateInput } from "../../types";
import { fetcher } from "./fetcher";

export async function fetchWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  return fetcher("/api/workout-templates");
}

export async function createWorkoutTemplate(input: CreateWorkoutTemplateInput): Promise<WorkoutTemplate> {
  return fetcher("/api/workout-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  return fetcher(`/api/workout-templates/${id}`, {
    method: "DELETE",
  });
}
```

- [ ] **Step 2: Export in `src/lib/data/api-client/index.ts`**
```typescript
export * from "./workout-templates";
```

### Task 5: Template Selector Modal in WorkoutForm

**Files:**
- Create: `src/components/workouts/TemplateSelectorModal.tsx`
- Modify: `src/components/workouts/WorkoutForm.tsx`

- [ ] **Step 1: Implement `TemplateSelectorModal.tsx`**
```tsx
"use client";

import React from "react";
import { WorkoutTemplate } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { X, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkoutTemplates, deleteWorkoutTemplate } from "@/lib/data/api-client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: WorkoutTemplate) => void;
}

export function TemplateSelectorModal({ isOpen, onClose, onSelect }: Props) {
  const queryClient = useQueryClient();
  
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["workoutTemplates"],
    queryFn: fetchWorkoutTemplates,
    enabled: isOpen
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkoutTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutTemplates"] });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-xl shadow-xl border border-border p-6 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-foreground">Start from Template</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {isLoading ? (
            <p className="text-muted text-sm text-center py-4">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">No templates saved yet.</p>
          ) : (
            templates.map(template => (
              <div key={template.id} className="p-3 border border-border rounded-lg flex items-center justify-between hover:border-accent-green/50 transition-default group">
                <div 
                  className="flex-1 cursor-pointer" 
                  onClick={() => {
                    onSelect(template);
                    onClose();
                  }}
                >
                  <p className="font-semibold text-foreground">{template.name}</p>
                  <p className="text-xs text-muted">{template.exercises.length} exercises</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this template?")) {
                      deleteMutation.mutate(template.id);
                    }
                  }}
                  className="p-2 text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Inject into `WorkoutForm.tsx`**
```tsx
// 1. Add imports
import { TemplateSelectorModal } from "./TemplateSelectorModal";
import { BookmarkPlus } from "lucide-react";

// 2. Add state inside WorkoutForm
const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

// 3. Add to UI (below the header)
// Find this section:
<div className="flex items-center justify-between mb-6">
    <h2 className="text-lg font-semibold text-foreground">
        {isEditMode ? "Edit Workout" : "Log Workout"}
    </h2>
// Add this below the h2:
    {!isEditMode && (
        <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="text-sm text-accent-green hover:underline flex items-center gap-1"
        >
            <BookmarkPlus size={16} /> Templates
        </button>
    )}

// 4. Add the modal at the bottom (inside the root div, below CreateExerciseModal):
<TemplateSelectorModal
    isOpen={isTemplateModalOpen}
    onClose={() => setIsTemplateModalOpen(false)}
    onSelect={(template) => {
        setFields(prev => ({
            ...prev,
            title: template.name,
            exercises: template.exercises.map(ex => ({ ...ex })) // Deep copy
        }));
    }}
/>
```

### Task 6: Template Builder UI

**Files:**
- Create: `src/app/(app)/templates/new/page.tsx`
- Create: `src/components/workouts/CreateTemplateForm.tsx`

- [ ] **Step 1: Implement `src/components/workouts/CreateTemplateForm.tsx`**
*(Note: Similar to `WorkoutForm.tsx` but removes duration/live-pump, and calls `createWorkoutTemplate`).*
```tsx
"use client";

import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createWorkoutTemplate, fetchCustomExercises, createCustomExercise } from "@/lib/data/api-client";
import { Exercise, TargetMuscle, CustomExercise } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PREDEFINED_EXERCISES } from "@/lib/constants/exercises";
import { mergeAndSortExercises } from "@/lib/domain/exercise-rules";
import { CreateExerciseModal } from "./CreateExerciseModal";
import { useRouter } from "next/navigation";

const emptyExercise: Exercise = {
    name: "",
    targetMuscle: TargetMuscle.Chest,
    sets: 3,
    reps: 10,
    weight: null,
};

export function CreateTemplateForm() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [exercises, setExercises] = useState<Exercise[]>([{ ...emptyExercise }]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const { data: customExercises = [] } = useQuery<CustomExercise[]>({
        queryKey: ["customExercises"],
        queryFn: fetchCustomExercises
    });

    const createExerciseMutation = useMutation({
        mutationFn: createCustomExercise,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["customExercises"] });
        }
    });

    const allExercises = useMemo(() => {
        return mergeAndSortExercises(PREDEFINED_EXERCISES, customExercises);
    }, [customExercises]);

    const groupedExercises = useMemo(() => {
        const groups: Record<string, typeof allExercises> = {};
        Object.values(TargetMuscle).forEach(m => groups[m] = []);
        groups["Other"] = [];
        
        allExercises.forEach(ex => {
            const groupKey = groups[ex.targetMuscle] ? ex.targetMuscle : "Other";
            groups[groupKey].push(ex);
        });
        return groups;
    }, [allExercises]);

    const addExercise = () => {
        setExercises(prev => [...prev, { ...emptyExercise }]);
    };

    const removeExercise = (index: number) => {
        setExercises(prev => prev.filter((_, i) => i !== index));
    };

    const updateExercise = (index: number, field: keyof Exercise, value: any) => {
        setExercises(prev => prev.map((ex, i) => i === index ? { ...ex, [field]: value } : ex));
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name.trim()) {
            setError("Template name is required");
            return;
        }

        const namedExercises = exercises.filter(ex => ex.name.trim());
        if (namedExercises.length === 0) {
            setError("At least one exercise is required");
            return;
        }

        setIsSubmitting(true);
        try {
            await createWorkoutTemplate({
                name: name.trim(),
                exercises: namedExercises,
                idempotencyKey: crypto.randomUUID()
            });
            queryClient.invalidateQueries({ queryKey: ["workoutTemplates"] });
            router.push("/workouts");
        } catch (err: any) {
            setError(err.message || "Failed to save template");
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputBase = "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted focus:border-accent-green focus:ring-1 focus:ring-accent-green/50 focus:outline-none transition-default";

    return (
        <Card className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-foreground mb-6">Create Template</h2>
            <form onSubmit={onSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm text-muted mb-2">Template Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Pull Day"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputBase}
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-muted">Exercises</label>
                        <button type="button" onClick={() => setIsModalOpen(true)} className="text-xs text-accent-green hover:underline flex items-center gap-1">
                            <Plus size={12} /> Create Custom
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        {exercises.map((exercise, index) => (
                            <div key={index} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-background">
                                <div className="flex-1 min-w-0">
                                    <select
                                        value={exercise.name}
                                        onChange={(e) => {
                                            const selectedName = e.target.value;
                                            const found = allExercises.find(ex => ex.name === selectedName);
                                            if (found) {
                                                updateExercise(index, "name", found.name);
                                                updateExercise(index, "targetMuscle", found.targetMuscle);
                                            } else {
                                                updateExercise(index, "name", "");
                                            }
                                        }}
                                        className={`${inputBase} mb-2 appearance-none`}
                                    >
                                        <option value="" disabled>Select an exercise...</option>
                                        {Object.entries(groupedExercises).map(([muscle, exs]) => {
                                            if (exs.length === 0) return null;
                                            return (
                                                <optgroup key={muscle} label={muscle}>
                                                    {exs.map(ex => (
                                                        <option key={ex.name} value={ex.name}>{ex.name}</option>
                                                    ))}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                    
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-xs text-muted mb-1">Sets</label>
                                            <input type="number" min={1} value={exercise.sets} onChange={(e) => updateExercise(index, "sets", parseInt(e.target.value) || 1)} className={inputBase} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted mb-1">Reps</label>
                                            <input type="number" min={1} value={exercise.reps} onChange={(e) => updateExercise(index, "reps", parseInt(e.target.value) || 1)} className={inputBase} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted mb-1">Weight (kg)</label>
                                            <input type="number" min={0} placeholder="BW" value={exercise.weight !== null ? exercise.weight : ""} onChange={(e) => updateExercise(index, "weight", e.target.value === "" ? null : parseFloat(e.target.value))} className={inputBase} />
                                        </div>
                                    </div>
                                </div>
                                {exercises.length > 1 && (
                                    <button type="button" onClick={() => removeExercise(index)} className="mt-1 p-2 text-muted hover:text-accent-red rounded-lg">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        
                        <button type="button" onClick={addExercise} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted hover:text-foreground">
                            <Plus size={16} /> Add Exercise
                        </button>
                    </div>
                </div>

                {error && <p className="text-sm text-accent-red">{error}</p>}
                
                <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                        {isSubmitting ? "Saving..." : "Save Template"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => router.push("/workouts")}>
                        Cancel
                    </Button>
                </div>
            </form>

            <CreateExerciseModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSubmit={async (data) => {
                    const newEx = await createExerciseMutation.mutateAsync(data);
                    setExercises(prev => [
                        ...(prev.length === 1 && prev[0].name === "" ? [] : prev),
                        { ...emptyExercise, name: newEx.name, targetMuscle: newEx.targetMuscle }
                    ]);
                }} 
            />
        </Card>
    );
}
```

- [ ] **Step 2: Implement `src/app/(app)/templates/new/page.tsx`**
```tsx
import { CreateTemplateForm } from "@/components/workouts/CreateTemplateForm";

export default function NewTemplatePage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Create Template
                </h1>
                <p className="text-muted mt-2">
                    Build a reusable workout routine to use later.
                </p>
            </div>

            <CreateTemplateForm />
        </div>
    );
}
```
