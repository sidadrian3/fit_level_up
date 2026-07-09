"use client";

import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createWorkout, updateWorkout, fetchCustomExercises, createCustomExercise } from "@/lib/data/api-client";
import { Workout, Exercise, TargetMuscle, CustomExercise } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";
import { useEntityForm } from "@/lib/hooks/useEntityForm";
import { CreateWorkoutSchema } from "@/lib/validations/schemas";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PREDEFINED_EXERCISES } from "@/lib/constants/exercises";
import { mergeAndSortExercises } from "@/lib/domain/exercise-rules";
import { CreateExerciseModal } from "./CreateExerciseModal";

const emptyExercise: Exercise = {
    name: "",
    targetMuscle: TargetMuscle.Chest,
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryClient = useQueryClient();

    // Fetch custom exercises
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

    // Combine and group exercises
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
            exercises: [{ ...emptyExercise }],
        },
        initialEntity: initialWorkout,
        entityToInput: (workout) => ({
            title: workout.title,
            duration: workout.duration,
            exercises: workout.exercises,
        }),
        onCreate: (input) => {
            const namedExercises = input.exercises.filter((ex) => ex.name.trim());
            return createWorkout({ ...input, title: input.title.trim(), exercises: namedExercises, idempotencyKey: crypto.randomUUID() });
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
        <>
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
                                <div
                                    key={index}
                                    className="flex items-start gap-2 p-3 rounded-lg border border-border bg-background"
                                >
                                    <div className="flex-1 min-w-0">
                                        <select
                                            value={exercise.name}
                                            onChange={(e) => {
                                                const selectedName = e.target.value;
                                                const found = allExercises.find(ex => ex.name === selectedName);
                                                if (found) {
                                                    setFields(prev => ({
                                                        ...prev,
                                                        exercises: prev.exercises.map((ex, i) => i === index ? { ...ex, name: found.name, targetMuscle: found.targetMuscle } : ex)
                                                    }));
                                                } else if (selectedName === "") {
                                                    // Handle clearing the select if we had an empty option
                                                    setFields(prev => ({
                                                        ...prev,
                                                        exercises: prev.exercises.map((ex, i) => i === index ? { ...ex, name: "" } : ex)
                                                    }));
                                                }
                                            }}
                                            className={`${inputBase} mb-2 appearance-none`}
                                        >
                                            <option value="" disabled>Select an exercise...</option>
                                            {Object.entries(groupedExercises).map(([muscle, exercises]) => {
                                                if (exercises.length === 0) return null;
                                                return (
                                                    <optgroup key={muscle} label={muscle}>
                                                        {exercises.map(ex => (
                                                            <option key={ex.name} value={ex.name}>{ex.name}</option>
                                                        ))}
                                                    </optgroup>
                                                );
                                            })}
                                        </select>
                                        
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

            <CreateExerciseModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSubmit={async (data) => {
                    const newExercise = await createExerciseMutation.mutateAsync(data);
                    
                    setFields(prev => ({
                        ...prev,
                        exercises: [
                            ...(prev.exercises.length === 1 && prev.exercises[0].name === "" ? [] : prev.exercises),
                            { ...emptyExercise, name: newExercise.name }
                        ]
                    }));
                }} 
            />
        </>
    );
}
