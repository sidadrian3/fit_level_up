"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TargetMuscle } from "@/lib/types";
import { X } from "lucide-react";

interface CreateExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; targetMuscle: TargetMuscle }) => Promise<void>;
}

export function CreateExerciseModal({ isOpen, onClose, onSubmit }: CreateExerciseModalProps) {
    const [name, setName] = useState("");
    const [targetMuscle, setTargetMuscle] = useState<TargetMuscle>(TargetMuscle.Chest);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Name is required");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);
            await onSubmit({ name: name.trim(), targetMuscle });
            setName("");
            setTargetMuscle(TargetMuscle.Chest);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to create exercise");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-foreground">Create Custom Exercise</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-muted hover:bg-card-hover transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">Exercise Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Bulgarian Split Squat"
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground text-sm focus:border-accent-green outline-none"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">Target Muscle</label>
                        <select
                            value={targetMuscle}
                            onChange={(e) => setTargetMuscle(e.target.value as TargetMuscle)}
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground text-sm focus:border-accent-green outline-none"
                        >
                            {Object.values(TargetMuscle).map(muscle => (
                                <option key={muscle} value={muscle}>{muscle}</option>
                            ))}
                        </select>
                    </div>

                    {error && <p className="text-accent-red text-sm">{error}</p>}

                    <div className="flex justify-end gap-3 mt-2">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Creating..." : "Create"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
