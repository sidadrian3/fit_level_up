"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { workoutTypeConfig } from "@/lib/constants/workout-icons";
import type { Workout, Exercise } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

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
 * Visual-only workout logging form.
 * Uses local state for type selection and exercise list management.
 * No submit logic — that comes later with a real backend.
 */
export function WorkoutForm({ className = "" }: { className?: string }) {
    const [selectedType, setSelectedType] =
        useState<Workout["type"]>("strength");
    const [exercises, setExercises] = useState<Exercise[]>([
        { ...emptyExercise },
    ]);
    const [duration, setDuration] = useState<number>(45);

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

    // Shared input styles
    const inputBase =
        "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted focus:border-accent-green focus:ring-1 focus:ring-accent-green/50 focus:outline-none transition-default";

    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <h2 className="text-lg font-bold text-foreground">
                Log Workout
            </h2>

            {/* Workout type selector — chip buttons */}
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

            {/* Exercise inputs */}
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
                            {/* Exercise name */}
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

                            {/* Remove button */}
                            {exercises.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeExercise(index)}
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

            {/* Duration input */}
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

            {/* Submit button */}
            <Button className="w-full" disabled>
                Log Workout
            </Button>
        </Card>
    );
}
