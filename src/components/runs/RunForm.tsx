"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createRun, updateRun } from "@/lib/data/repositories";
import type { Run } from "@/lib/types";
import { X } from "lucide-react";

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
 * Run logging form — creates new or edits existing run.
 * When initialRun is provided, enters edit mode.
 */
export function RunForm({
    className = "",
    onRunLogged,
    initialRun,
    onCancel,
}: {
    className?: string;
    onRunLogged?: () => void;
    initialRun?: Run;
    onCancel?: () => void;
}) {
    const isEditMode = !!initialRun;
    const [distance, setDistance] = useState<number>(5.0);
    const [duration, setDuration] = useState<number>(30);
    const [selectedDifficulty, setSelectedDifficulty] =
        useState<Run["difficulty"]>("moderate");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Populate form when editing
    useEffect(() => {
        if (initialRun) {
            setDistance(initialRun.distance);
            setDuration(initialRun.duration);
            setSelectedDifficulty(initialRun.difficulty);
            setError(null);
        }
    }, [initialRun]);

    function resetForm() {
        setDistance(0);
        setDuration(0);
        setSelectedDifficulty("moderate");
        setError(null);
    }

    function handleCancel() {
        resetForm();
        onCancel?.();
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (distance <= 0) {
            setError("Distance must be greater than 0");
            return;
        }
        if (duration <= 0) {
            setError("Duration must be greater than 0");
            return;
        }

        try {
            setIsSubmitting(true);
            if (isEditMode && initialRun) {
                await updateRun(initialRun.id, {
                    distance,
                    duration,
                    difficulty: selectedDifficulty,
                });
            } else {
                await createRun({
                    distance,
                    duration,
                    difficulty: selectedDifficulty,
                });
            }
            if (!isEditMode) {
                resetForm();
            }
            onRunLogged?.();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : isEditMode
                    ? "Failed to update run"
                    : "Failed to log run"
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    const inputBase =
        "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm placeholder:text-muted focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 focus:outline-none transition-default";

    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                    {isEditMode ? "Edit Run" : "Log Run"}
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
                        ? "Update Run"
                        : "Log Run"}
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
