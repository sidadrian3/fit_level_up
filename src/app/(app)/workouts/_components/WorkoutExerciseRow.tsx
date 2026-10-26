"use client";

import { Trash2 } from "lucide-react";
import type { useExerciseCatalog } from "@/lib/exercises/hooks/useExerciseCatalog";
import type { Exercise, TargetMuscle } from "@/shared/contracts/exercise";

export const workoutInputClass =
    "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted focus:border-accent-green focus:ring-1 focus:ring-accent-green/50 focus:outline-none transition-default";

type Catalog = Pick<ReturnType<typeof useExerciseCatalog>, "exerciseGroups" | "findExercise">;

export function WorkoutExerciseRow({
    exercise,
    catalog,
    onChange,
    onRemove,
    onFocusMuscle,
}: {
    exercise: Exercise;
    catalog: Catalog;
    onChange: (patch: Partial<Exercise>) => void;
    onRemove?: () => void;
    onFocusMuscle: (muscle: TargetMuscle) => void;
}) {
    const focusOwnMuscle = () => exercise.name && onFocusMuscle(exercise.targetMuscle);

    return (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-background">
            <div className="flex-1 min-w-0">
                <select
                    onFocus={() => {
                        if (!exercise.name) return;
                        const found = catalog.findExercise(exercise.name);
                        if (found) onFocusMuscle(found.targetMuscle);
                    }}
                    value={exercise.name}
                    onChange={(e) => {
                        const selectedName = e.target.value;
                        const found = catalog.findExercise(selectedName);
                        if (found) {
                            onFocusMuscle(found.targetMuscle);
                            onChange({ name: found.name, targetMuscle: found.targetMuscle });
                        } else if (selectedName === "") {
                            onChange({ name: "" });
                        }
                    }}
                    className={`${workoutInputClass} mb-2 appearance-none`}
                >
                    <option value="" disabled>Select an exercise...</option>
                    {Object.entries(catalog.exerciseGroups).map(([muscle, exercises]) => {
                        if (exercises.length === 0) return null;
                        return (
                            <optgroup key={muscle} label={muscle}>
                                {exercises.map((ex) => (
                                    <option key={ex.name} value={ex.name}>{ex.name}</option>
                                ))}
                            </optgroup>
                        );
                    })}
                </select>

                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="block text-xs text-muted mb-1">Sets</label>
                        <input
                            type="number"
                            min={1}
                            onFocus={focusOwnMuscle}
                            value={exercise.sets}
                            onChange={(e) => onChange({ sets: parseInt(e.target.value) || 1 })}
                            className={workoutInputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-1">Reps</label>
                        <input
                            type="number"
                            min={1}
                            onFocus={focusOwnMuscle}
                            value={exercise.reps}
                            onChange={(e) => onChange({ reps: parseInt(e.target.value) || 1 })}
                            className={workoutInputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-1">Weight (kg)</label>
                        <input
                            type="number"
                            min={0}
                            placeholder="BW"
                            onFocus={focusOwnMuscle}
                            value={exercise.weight !== null ? exercise.weight : ""}
                            onChange={(e) =>
                                onChange({ weight: e.target.value === "" ? null : parseFloat(e.target.value) })
                            }
                            className={workoutInputClass}
                        />
                    </div>
                </div>
            </div>

            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="mt-1 p-2 text-muted hover:text-accent-red transition-default rounded-lg hover:bg-accent-red/10"
                    aria-label="Remove exercise"
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );
}
