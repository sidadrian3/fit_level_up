"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Run } from "@/lib/types";

const difficulties: Run["difficulty"][] = [
    "easy",
    "moderate",
    "hard",
    "intense",
];

/** Difficulty → chip colors */
const difficultyChipColors: Record<
    Run["difficulty"],
    { active: string; label: string }
> = {
    easy: {
        active: "bg-accent-green/15 text-accent-green border-transparent",
        label: "Easy",
    },
    moderate: {
        active: "bg-accent-blue/15 text-accent-blue border-transparent",
        label: "Moderate",
    },
    hard: {
        active: "bg-accent-orange/15 text-accent-orange border-transparent",
        label: "Hard",
    },
    intense: {
        active: "bg-accent-red/15 text-accent-red border-transparent",
        label: "Intense",
    },
};

/**
 * Visual-only run logging form.
 * Distance, duration, difficulty selector — no submit logic yet.
 */
export function RunForm({ className = "" }: { className?: string }) {
    const [distance, setDistance] = useState<number>(5.0);
    const [duration, setDuration] = useState<number>(30);
    const [selectedDifficulty, setSelectedDifficulty] =
        useState<Run["difficulty"]>("moderate");

    const inputBase =
        "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 focus:outline-none transition-default";

    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <h2 className="text-lg font-bold text-foreground">Log Run</h2>

            {/* Distance input */}
            <div>
                <label className="block text-sm text-muted mb-2">
                    Distance
                </label>
                <div className="relative">
                    <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={distance}
                        onChange={(e) =>
                            setDistance(parseFloat(e.target.value) || 0)
                        }
                        className={inputBase}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">
                        km
                    </span>
                </div>
            </div>

            {/* Duration input */}
            <div>
                <label className="block text-sm text-muted mb-2">
                    Duration
                </label>
                <div className="relative">
                    <input
                        type="number"
                        min={1}
                        value={duration}
                        onChange={(e) =>
                            setDuration(parseInt(e.target.value) || 1)
                        }
                        className={inputBase}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">
                        min
                    </span>
                </div>
            </div>

            {/* Difficulty selector */}
            <div>
                <label className="block text-sm text-muted mb-2">
                    Difficulty
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {difficulties.map((diff) => {
                        const config = difficultyChipColors[diff];
                        const isActive = selectedDifficulty === diff;

                        return (
                            <button
                                key={diff}
                                type="button"
                                onClick={() => setSelectedDifficulty(diff)}
                                className={`
                                    px-4 py-2.5 rounded-lg text-sm font-semibold
                                    transition-all duration-200 border text-center
                                    ${
                                        isActive
                                            ? config.active
                                            : "border-border text-muted hover:bg-card-hover hover:text-foreground"
                                    }
                                `}
                            >
                                {config.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Submit */}
            <Button className="w-full" disabled>
                Log Run
            </Button>
        </Card>
    );
}
