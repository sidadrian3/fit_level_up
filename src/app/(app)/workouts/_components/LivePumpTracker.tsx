"use client";

import { useMemo } from "react";
import { AnatomyModel } from "@/components/ui/AnatomyModel";
import { TargetMuscle, type Exercise } from "@/shared/contracts/exercise";
import { calcMuscleVolume } from "@/shared/muscle-volume";
import type { Workout } from "@/shared/contracts/workout";

export function LivePumpTracker({
    exercises,
    activeMuscle,
}: {
    exercises: Exercise[];
    activeMuscle: TargetMuscle | null;
}) {
    const intensities = useMemo(() => {
        const mockWorkout: Workout = {
            id: "temp",
            title: "temp",
            duration: 1,
            xpEarned: 0,
            date: new Date().toISOString(),
            exercises: exercises.filter((ex) => ex.name.trim() !== ""),
        };
        return calcMuscleVolume([mockWorkout], 1, new Date());
    }, [exercises]);

    return (
        <div className="w-full lg:w-48 shrink-0 flex flex-col items-center border-t lg:border-t-0 lg:border-l border-border pt-8 lg:pt-0 lg:pl-8">
            <h4 className="text-center font-bold text-muted text-xs mb-4 uppercase tracking-wider">Live Pump Tracker</h4>
            <div className="w-32 lg:w-40">
                <AnatomyModel
                    intensities={intensities}
                    activeMuscle={activeMuscle}
                    view={activeMuscle === TargetMuscle.Back ? "back" : "front"}
                />
            </div>
        </div>
    );
}
