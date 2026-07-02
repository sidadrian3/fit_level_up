"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { workoutTypeConfig } from "@/lib/constants/workout-icons";
import { createWorkout, updateWorkout } from "@/lib/data/api-client";
import type { Workout, Exercise } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";
import { useEntityForm } from "@/lib/hooks/useEntityForm";
import { CreateWorkoutSchema } from "@/lib/validations/schemas";

const workoutTypes: Workout["type"][] = [
    "strength",
    "cardio",
    "hiit",
    "flexibility",
];

const emptyExercise: Exercise = {
    name: "",
    sets: 3,
    reps: 10,
    weight: null,
};

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
            type: "strength" as Workout["type"],
            duration: 45,
            exercises: [{ ...emptyExercise }],
        },
        initialEntity: initialWorkout,
        entityToInput: (workout) => ({
            title: workout.title,
            type: workout.type,
            duration: workout.duration,
            exercises: workout.exercises,
        }),
        onCreate: (input) => {
            const namedExercises = input.exercises.filter((ex) => ex.name.trim());
            return createWorkout({ ...input, title: input.title.trim(), exercises: namedExercises });
        },
        onUpdate: (id, input) => {
            const namedExercises = input.exercises.filter((ex) => ex.name.trim());
            return updateWorkout(id, { ...input, title: input.title.trim(), exercises: namedExercises });
        },
        getId: (w) => w.id,
        onSuccess: onWorkoutLogged,
    });

    const addExercise = () => {
        setFields((prev) => ({ ...prev, exercises: [...prev.exercises, { ...emptyExercise }] }));
    };

    const removeExercise = (index: number) => {
        setFields((prev) => ({
            ...prev,
            exercises: prev.exercises.filter((_, i) => i !== index),
        }));
    };

    const updateExercise = (
        index: number,
        field: keyof Exercise,
        value: string | number | null
    ) => {
        setFields((prev) => ({
            ...prev,
            exercises: prev.exercises.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)),
        }));
    };

    async function onSubmit(e: React.FormEvent) {
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

    const inputBase =
        "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted focus:border-accent-green focus:ring-1 focus:ring-accent-green/50 focus:outline-none transition-default";

    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                    {isEditMode ? "Edit Workout" : "Log Workout"}
                </h2>
                {isEditMode && onCancel && (
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="p-1 text-muted hover:text-foreground hover:bg-card-hover rounded transition-default"
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
                        className={inputBase}
                    />
                </div>

                <div>
                    <label className="block text-sm text-muted mb-2">
                        Workout Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {workoutTypes.map((type) => {
                            const config = workoutTypeConfig[type];
                            const isActive = fields.type === type;
                            const Icon = config.icon;

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFields((prev) => ({ ...prev, type }))}
                                    className={`
                                    inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                                    transition-all duration-200 border
                                    ${
                                        isActive
                                            ? `${config.bg} ${config.color} border-transparent`
                                            : "border-border text-muted hover:bg-card-hover hover:text-foreground"
                                    }
                                `}
                                >
                                    <Icon size={16} />
                                    {config.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-muted mb-2">
                        Exercises
                    </label>
                    <div className="space-y-3">
                        {fields.exercises.map((exercise, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-2 p-3 rounded-lg border border-border bg-background"
                            >
                                <div className="flex-1 min-w-0">
                                    <input
                                        type="text"
                                        placeholder="Exercise name"
                                        value={exercise.name}
                                        onChange={(e) =>
                                            updateExercise(
                                                index,
                                                "name",
                                                e.target.value
                                            )
                                        }
                                        className={`${inputBase} mb-2`}
                                    />
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-xs text-muted mb-1">
                                                Sets
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={exercise.sets}
                                                onChange={(e) =>
                                                    updateExercise(
                                                        index,
                                                        "sets",
                                                        parseInt(
                                                            e.target.value
                                                        ) || 1
                                                    )
                                                }
                                                className={inputBase}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted mb-1">
                                                Reps
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={exercise.reps}
                                                onChange={(e) =>
                                                    updateExercise(
                                                        index,
                                                        "reps",
                                                        parseInt(
                                                            e.target.value
                                                        ) || 1
                                                    )
                                                }
                                                className={inputBase}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted mb-1">
                                                Weight (kg)
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="BW"
                                                value={
                                                    exercise.weight !== null
                                                        ? exercise.weight
                                                        : ""
                                                }
                                                onChange={(e) =>
                                                    updateExercise(
                                                        index,
                                                        "weight",
                                                        e.target.value === ""
                                                            ? null
                                                            : parseFloat(
                                                                  e.target.value
                                                              )
                                                    )
                                                }
                                                className={inputBase}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {fields.exercises.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeExercise(index)
                                        }
                                        className="mt-1 p-2 text-muted hover:text-accent-red transition-default rounded-lg hover:bg-accent-red/10"
                                        aria-label="Remove exercise"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
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
                        className={inputBase}
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
        </Card>
    );
}
