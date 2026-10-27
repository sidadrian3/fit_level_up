"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useExerciseCatalog } from "@/lib/exercises/hooks/useExerciseCatalog";
import { useLogWorkout } from "@/lib/workouts/hooks/useLogWorkout";
import { useUpdateWorkout } from "@/lib/workouts/hooks/useUpdateWorkout";
import type { Workout } from "@/shared/contracts/workout";
import { TargetMuscle, type Exercise } from "@/shared/contracts/exercise";
import { Plus, X } from "lucide-react";
import { useEntityForm } from "@/lib/hooks/useEntityForm";
import { CreateWorkoutSchema } from "@/shared/contracts/workout";
import { EMPTY_EXERCISE } from "@/lib/constants/exercises";
import { CreateExerciseModal } from "@/components/shared/exercises/CreateExerciseModal";
import { TemplateSelectorModal } from "./TemplateSelectorModal";
import { BookmarkPlus } from "lucide-react";
import { LivePumpTracker } from "./LivePumpTracker";
import { WorkoutExerciseRow, workoutInputClass } from "./WorkoutExerciseRow";

/**
 * Workout form — creates new or edits existing workout.
 * When initialWorkout is provided, enters edit mode.
 */
export function WorkoutForm({
    className = "",
    onWorkoutLogged,
    initialWorkout,
    onCancel,
}: {
    className?: string;
    onWorkoutLogged?: () => void;
    initialWorkout?: Workout;
    onCancel?: () => void;
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [activeMuscle, setActiveMuscle] = useState<TargetMuscle | null>(null);

    const catalog = useExerciseCatalog();
    const logWorkoutMutation = useLogWorkout();
    const updateWorkoutMutation = useUpdateWorkout();

    const {
        fields,
        setFields,
        isEditMode,
        isSubmitting,
        error,
        setError,
        handleSubmit,
        handleCancel,
    } = useEntityForm({
        defaults: {
            title: "",
            duration: 45,
            exercises: [{ ...EMPTY_EXERCISE }],
        },
        initialEntity: initialWorkout,
        entityToInput: (workout) => ({
            title: workout.title,
            duration: workout.duration,
            exercises: workout.exercises,
        }),
        onCreate: (input, key) => {
            const namedExercises = input.exercises.filter((ex) => ex.name.trim());
            return logWorkoutMutation.mutateAsync({
                input: { ...input, title: input.title.trim(), exercises: namedExercises },
                idempotencyKey: key,
            });
        },
        onUpdate: (id, input) => {
            const namedExercises = input.exercises.filter((ex) => ex.name.trim());
            return updateWorkoutMutation.mutateAsync({
                id,
                input: { ...input, title: input.title.trim(), exercises: namedExercises },
            });
        },
        getId: (w) => w.id,
        onSuccess: () => {
            if (onWorkoutLogged) onWorkoutLogged();
        },
        onAlreadySaved: onWorkoutLogged,
    });

    const addExercise = () => {
        setFields((prev) => ({ ...prev, exercises: [...prev.exercises, { ...EMPTY_EXERCISE }] }));
    };

    const removeExercise = (index: number) => {
        setFields((prev) => ({
            ...prev,
            exercises: prev.exercises.filter((_, i) => i !== index),
        }));
    };

    const updateExercise = (index: number, patch: Partial<Exercise>) => {
        setFields((prev) => ({
            ...prev,
            exercises: prev.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)),
        }));
    };

    async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();

        const namedExercises = fields.exercises.filter((ex) => ex.name.trim());
        const dataToValidate = {
            ...fields,
            title: fields.title.trim(),
            exercises: namedExercises
        };

        const result = CreateWorkoutSchema.safeParse(dataToValidate);

        if (!result.success) {
            setError(result.error.issues[0].message);
            return;
        }

        await handleSubmit();
    }

    return (
        <div className={`w-full ${className}`}>
            <Card className="flex flex-col lg:flex-row gap-8">
                
                {/* Left side: Form Inputs */}
                <div className="flex-1 flex flex-col min-w-[300px]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-semibold text-foreground">
                                {isEditMode ? "Edit Workout" : "Log Workout"}
                            </h2>
                            {!isEditMode && (
                                <button
                                    type="button"
                                    onClick={() => setIsTemplateModalOpen(true)}
                                    className="px-3 py-1.5 text-sm font-medium text-accent-green bg-accent-green/10 hover:bg-accent-green/20 rounded-lg flex items-center gap-1.5 transition-colors active:scale-95"
                                >
                                    <BookmarkPlus size={16} /> Templates
                                </button>
                            )}
                        </div>
                        {isEditMode && onCancel && (
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="p-2 -mr-2 text-muted hover:text-foreground hover:bg-card-hover rounded-full transition-colors active:scale-95"
                                aria-label="Cancel edit"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    <form onSubmit={onSubmit} className="flex flex-col gap-6">
                        <div>
                            <label className="block text-sm text-muted mb-2">
                                Workout Title
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Upper Body Power"
                                value={fields.title}
                                onChange={(e) => setFields((prev) => ({ ...prev, title: e.target.value }))}
                                className={workoutInputClass}
                            />
                        </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm text-muted">
                                Exercises
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="text-xs text-accent-green hover:underline flex items-center gap-1"
                            >
                                <Plus size={12} /> Create Custom
                            </button>
                        </div>
                        <div className="space-y-3">
                            {fields.exercises.map((exercise, index) => (
                                <WorkoutExerciseRow
                                    key={index}
                                    exercise={exercise}
                                    catalog={catalog}
                                    onChange={(patch) => updateExercise(index, patch)}
                                    onRemove={fields.exercises.length > 1 ? () => removeExercise(index) : undefined}
                                    onFocusMuscle={setActiveMuscle}
                                />
                            ))}

                            <button
                                type="button"
                                onClick={addExercise}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted hover:text-foreground hover:border-accent-green/50 transition-default"
                            >
                                <Plus size={16} />
                                Add Exercise
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-muted mb-2">
                            Duration (minutes)
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={fields.duration}
                            onChange={(e) =>
                                setFields((prev) => ({ ...prev, duration: parseInt(e.target.value) || 1 }))
                            }
                            className={workoutInputClass}
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? isEditMode
                                    ? "Updating..."
                                    : "Logging..."
                                : isEditMode
                                    ? "Update Workout"
                                    : "Log Workout"}
                        </Button>
                        {isEditMode && onCancel && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>

                        {error && (
                            <p className="text-sm text-accent-red">{error}</p>
                        )}
                    </form>
                </div>

                <LivePumpTracker exercises={fields.exercises} activeMuscle={activeMuscle} />
            </Card>

            <CreateExerciseModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSubmit={async (data) => {
                    const newExercise = await catalog.createCustomExercise(data);
                    
                    setFields(prev => ({
                        ...prev,
                        exercises: [
                            ...(prev.exercises.length === 1 && prev.exercises[0].name === "" ? [] : prev.exercises),
                            { ...EMPTY_EXERCISE, name: newExercise.name, targetMuscle: newExercise.targetMuscle }
                        ]
                    }));
                }} 
            />

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
        </div>
    );
}
