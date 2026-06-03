"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { workoutTypeConfig } from "@/lib/constants/workout-icons";
import { createWorkout, updateWorkout } from "@/lib/data/repositories";
import type { Workout, Exercise } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";

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
    const isEditMode = !!initialWorkout;
    const [title, setTitle] = useState("");
    const [selectedType, setSelectedType] =
        useState<Workout["type"]>("strength");
    const [exercises, setExercises] = useState<Exercise[]>([
        { ...emptyExercise },
    ]);
    const [duration, setDuration] = useState<number>(45);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Populate form when editing
    useEffect(() => {
        if (initialWorkout) {
            setTitle(initialWorkout.title);
            setSelectedType(initialWorkout.type);
            setExercises(initialWorkout.exercises);
            setDuration(initialWorkout.duration);
            setError(null);
        }
    }, [initialWorkout]);

    const addExercise = () => {
        setExercises((prev) => [...prev, { ...emptyExercise }]);
    };

    const removeExercise = (index: number) => {
        setExercises((prev) => prev.filter((_, i) => i !== index));
    };

    const updateExercise = (
        index: number,
        field: keyof Exercise,
        value: string | number | null
    ) => {
        setExercises((prev) =>
            prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
        );
    };

    function resetForm() {
        setTitle("");
        setSelectedType("strength");
        setExercises([{ ...emptyExercise }]);
        setDuration(45);
        setError(null);
    }

    function handleCancel() {
        resetForm();
        onCancel?.();
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const namedExercises = exercises.filter((ex) => ex.name.trim());
        if (!title.trim()) {
            setError("Enter a workout title");
            return;
        }
        if (namedExercises.length === 0) {
            setError("Add at least one exercise with a name");
            return;
        }

        try {
            setIsSubmitting(true);
            if (isEditMode && initialWorkout) {
                await updateWorkout(initialWorkout.id, {
                    type: selectedType,
                    title: title.trim(),
                    exercises: namedExercises,
                    duration,
                });
            } else {
                await createWorkout({
                    type: selectedType,
                    title: title.trim(),
                    exercises: namedExercises,
                    duration,
                });
            }
            if (!isEditMode) {
                resetForm();
            }
            onWorkoutLogged?.();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : isEditMode ? "Failed to update workout" : "Failed to log workout"
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    const inputBase =
        "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted focus:border-accent-green focus:ring-1 focus:ring-accent-green/50 focus:outline-none transition-default";

    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                    <label className="block text-sm text-muted mb-2">
                        Workout Title
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Upper Body Power"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
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
                            const isActive = selectedType === type;
                            const Icon = config.icon;

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSelectedType(type)}
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
                        {exercises.map((exercise, index) => (
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

                                {exercises.length > 1 && (
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
                        value={duration}
                        onChange={(e) =>
                            setDuration(parseInt(e.target.value) || 1)
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
