import React from "react";
import { Dumbbell, Edit, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Workout, Exercise } from "@/lib/types";

export interface WorkoutCardProps {
    workout: Workout;
    className?: string;
    onDelete?: (id: string) => void;
    onUpdate?: (id: string) => void;
}

function getPrimaryFocus(exercises: Exercise[]): string {
    if (!exercises || exercises.length === 0) return "Mixed Workout";
    
    const counts: Record<string, number> = {};
    let maxCount = 0;
    let focus = "";

    for (const ex of exercises) {
        if (!ex.targetMuscle) continue;
        counts[ex.targetMuscle] = (counts[ex.targetMuscle] || 0) + 1;
        if (counts[ex.targetMuscle] > maxCount) {
            maxCount = counts[ex.targetMuscle];
            focus = ex.targetMuscle;
        }
    }
    
    return focus ? `${focus} Day` : "Mixed Workout";
}

/**
 * Displays a single workout in a rich card layout.
 * Shows title, dynamically inferred focus, exercise breakdown, and stats footer.
 */
export function WorkoutCard({ workout, className = "", onDelete, onUpdate }: WorkoutCardProps) {
    const primaryFocus = getPrimaryFocus(workout.exercises);

    return (
        <Card
            className={`flex flex-col gap-4 hover:border-accent-green/30 hover:scale-[1.01] transition-all duration-200 ${className}`}
        >
            {/* Header: icon + title + focus */}
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-accent-blue/10 text-accent-blue"
                >
                    <Dumbbell size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                        {workout.title}
                    </h3>
                    <span
                        className="text-xs font-medium text-accent-blue"
                    >
                        {primaryFocus}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        className="p-2 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors shrink-0"
                        aria-label="Update workout"
                        onClick={() => onUpdate?.(workout.id)}
                    >
                        <Edit size={18} />
                    </button>
                    <button
                        className="p-2 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors shrink-0"
                        aria-label="Delete workout"
                        onClick={() => onDelete?.(workout.id)}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Exercise list */}
            <div className="space-y-1.5">
                {workout.exercises.map((exercise, index) => (
                    <div
                        key={index}
                        className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-background"
                    >
                        <span className="text-foreground font-medium truncate">
                            {exercise.name}
                        </span>
                        <span className="text-muted whitespace-nowrap ml-3">
                            {exercise.sets} × {exercise.reps}
                            {exercise.weight !== null
                                ? ` @ ${exercise.weight} kg`
                                : " BW"}
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer: duration, date, XP */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{formatDuration(workout.duration)}</span>
                    <span>•</span>
                    <span>{formatDate(workout.date)}</span>
                </div>
                <span className="text-sm font-semibold text-accent-green">
                    +{workout.xpEarned} XP
                </span>
            </div>
        </Card>
    );
}
