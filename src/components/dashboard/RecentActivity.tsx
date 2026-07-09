import React from "react";
import { Card } from "@/components/ui/Card";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Workout } from "@/lib/types";
import { Dumbbell } from "lucide-react";

export interface RecentActivityProps {
    workouts: readonly Workout[];
    className?: string;
}

export function RecentActivity({ workouts, className = "" }: RecentActivityProps) {
    if (!workouts || workouts.length === 0) {
        return (
            <Card className={className}>
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
                <p className="text-sm text-muted text-center py-4">No recent workouts logged.</p>
            </Card>
        );
    }

    return (
        <Card className={`flex flex-col gap-4 ${className}`}>
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
            <div className="space-y-3">
                {workouts.map((workout) => {
                    return (
                        <div key={workout.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-background hover:bg-card-hover transition-default">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-accent-blue/10 text-accent-blue">
                                <Dumbbell size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-foreground truncate">{workout.title}</h4>
                                <div className="flex items-center gap-2 text-xs text-muted mt-1">
                                    <span>{formatDate(workout.date)}</span>
                                    <span>•</span>
                                    <span>{formatDuration(workout.duration)}</span>
                                </div>
                            </div>
                            <div className="text-sm font-semibold text-accent-green whitespace-nowrap">
                                +{workout.xpEarned} XP
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
