import React from "react";
import { Card } from "@/components/ui/Card";
import { formatDate, formatDuration, formatPace } from "@/lib/utils";
import type { Run } from "@/lib/types";
import { Footprints } from "lucide-react";

export interface RunCardProps {
    run: Run;
    className?: string;
}

/** Difficulty → color mapping for the pill badge */
const difficultyColors: Record<Run["difficulty"], { text: string; bg: string }> = {
    easy: { text: "text-accent-green", bg: "bg-accent-green/10" },
    moderate: { text: "text-accent-blue", bg: "bg-accent-blue/10" },
    hard: { text: "text-accent-orange", bg: "bg-accent-orange/10" },
    intense: { text: "text-accent-red", bg: "bg-accent-red/10" },
};

/**
 * Displays a single run log entry.
 * Compact horizontal layout with distance, pace, difficulty badge, and XP.
 */
export function RunCard({ run, className = "" }: RunCardProps) {
    const diff = difficultyColors[run.difficulty] || difficultyColors.easy;

    return (
        <Card
            className={`flex items-center gap-4 hover:border-accent-blue/30 hover:scale-[1.01] transition-all duration-200 ${className}`}
        >
            {/* Run icon */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-accent-blue/10 text-accent-blue">
                <Footprints size={24} />
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-foreground">
                        {run.distance} km
                    </span>
                    <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${diff.text} ${diff.bg}`}
                    >
                        {run.difficulty}
                    </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{formatPace(run.pace)}</span>
                    <span>•</span>
                    <span>{formatDuration(run.duration)}</span>
                    <span>•</span>
                    <span>{formatDate(run.date)}</span>
                </div>
            </div>

            {/* XP earned */}
            <span className="text-sm font-bold text-accent-green whitespace-nowrap">
                +{run.xpEarned} XP
            </span>
        </Card>
    );
}
