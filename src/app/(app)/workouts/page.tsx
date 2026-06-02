"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { WorkoutForm } from "@/components/workouts/WorkoutForm";
import { getWorkouts } from "@/lib/data/repositories";
import type { Workout } from "@/lib/types";

export default function WorkoutsPage() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadWorkouts() {
        try {
            setError(null);
            setIsLoading(true);
            const data = await getWorkouts();
            setWorkouts([...data]);
        } catch {
            setError("Could not load workouts");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadWorkouts();
    }, []);

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Workouts 🏋️"
                subtitle="Track your training sessions"
            />

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <WorkoutForm
                    className="xl:col-span-3"
                    onWorkoutLogged={loadWorkouts}
                />

                <div className="xl:col-span-2 space-y-4">
                    <h2 className="text-lg font-bold text-foreground">
                        Workout History
                    </h2>
                    {isLoading && (
                        <p className="text-sm text-muted">Loading...</p>
                    )}
                    {error && (
                        <p className="text-sm text-accent-red">{error}</p>
                    )}
                    {!isLoading &&
                        !error &&
                        workouts.map((workout) => (
                            <WorkoutCard
                                key={workout.id}
                                workout={workout}
                            />
                        ))}
                </div>
            </div>
        </div>
    );
}
