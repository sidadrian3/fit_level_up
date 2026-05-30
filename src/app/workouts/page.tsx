"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { WorkoutForm } from "@/components/workouts/WorkoutForm";
import { getWorkouts } from "@/lib/data/repositories";

export default function WorkoutsPage() {
    const workouts = getWorkouts();

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Workouts 🏋️"
                subtitle="Track your training sessions"
            />

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Form — ~60% on desktop */}
                <WorkoutForm className="xl:col-span-3" />

                {/* History — ~40% on desktop */}
                <div className="xl:col-span-2 space-y-4">
                    <h2 className="text-lg font-bold text-foreground">
                        Workout History
                    </h2>
                    {workouts.map((workout) => (
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
