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

    const updateExercise = (index: number, field: keyof Exercise, value: string | number | null) => {
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
            setIsSubmitting(false);
        }
    };

    const inputBase = "w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground text-sm placeholder:text-muted focus:border-accent-green focus:ring-1 focus:ring-accent-green/50 focus:outline-none transition-all";

    return (
        <Card className="max-w-2xl mx-auto shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-6">Template Details</h2>
            <form onSubmit={onSubmit} className="space-y-8">
                <div>
                    <label htmlFor="template-name" className="block text-sm font-medium text-muted mb-2">
                        Template Name
                    </label>
                    <input
                        id="template-name"
                        type="text"
                        placeholder="e.g. Pull Day"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputBase}
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-muted">
                            Exercises
                        </label>
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(true)} 
                            className="text-xs px-3 py-1.5 font-medium text-accent-green bg-accent-green/10 hover:bg-accent-green/20 rounded-lg flex items-center gap-1 transition-colors active:scale-95"
                        >
                            <Plus size={14} /> Create Custom
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {exercises.map((exercise, index) => (
                            <div key={index} className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-background shadow-sm relative group">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 w-full mr-12">
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
                                            className={`${inputBase} appearance-none cursor-pointer w-full`}
                                            aria-label="Select exercise"
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
                                    </div>
                                    
                                    {exercises.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => removeExercise(index)} 
                                            className="absolute right-3 top-3 p-2.5 text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors active:scale-95"
                                            aria-label="Remove exercise"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-muted mb-1.5 ml-1">Sets</label>
                                        <input 
                                            type="number" 
                                            min={1} 
                                            value={exercise.sets} 
                                            onChange={(e) => updateExercise(index, "sets", parseInt(e.target.value) || 1)} 
                                            className={inputBase} 
                                            aria-label="Sets"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-muted mb-1.5 ml-1">Reps</label>
                                        <input 
                                            type="number" 
                                            min={1} 
                                            value={exercise.reps} 
                                            onChange={(e) => updateExercise(index, "reps", parseInt(e.target.value) || 1)} 
                                            className={inputBase} 
                                            aria-label="Reps"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-muted mb-1.5 ml-1">Weight (kg)</label>
                                        <input 
                                            type="number" 
                                            min={0} 
                                            placeholder="BW" 
                                            value={exercise.weight !== null ? exercise.weight : ""} 
                                            onChange={(e) => updateExercise(index, "weight", e.target.value === "" ? null : parseFloat(e.target.value))} 
                                            className={inputBase} 
                                            aria-label="Weight"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <button 
                            type="button" 
                            onClick={addExercise} 
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted hover:text-foreground hover:border-accent-green/50 hover:bg-accent-green/5 transition-all active:scale-[0.99]"
                        >
                            <Plus size={18} /> Add Exercise
                        </button>
                    </div>
                </div>

                {error && <p className="text-sm text-accent-red p-3 bg-accent-red/10 rounded-lg">{error}</p>}
                
                <div className="flex gap-4 pt-4 border-t border-border">
                    <Button type="button" variant="secondary" onClick={() => router.push("/workouts")} className="flex-1 py-3 text-base">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="flex-1 py-3 text-base font-semibold">
                        {isSubmitting ? "Saving..." : "Save Template"}
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
