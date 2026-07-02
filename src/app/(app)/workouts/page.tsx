"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { WorkoutForm } from "@/components/workouts/WorkoutForm";
import { getWorkouts, deleteWorkout, updateWorkout } from "@/lib/data/api-client";
import type { Workout } from "@/lib/types";

export default function WorkoutsPage() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const editingWorkout = workouts.find(w => w.id === editingId);

    async function loadWorkouts(pageNum = 1) {
        try {
            setError(null);
            if (pageNum === 1) setIsLoading(true);
            else setIsLoadingMore(true);

            const data = await getWorkouts(pageNum, 5);
            
            if (pageNum === 1) {
                setWorkouts([...data]);
            } else {
                setWorkouts(prev => [...prev, ...data]);
            }
            
            setHasMore(data.length === 5);
            setPage(pageNum);
        } catch {
            setError("Could not load workouts");
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteWorkout(id);
            await loadWorkouts();
        } catch (err) {
            console.error("Delete failed:", err);
            setError("Failed to delete workout");
        }
    };

    const handleUpdate = async (id: string) => {
        setEditingId(id);
    };

    const handleEditComplete = async () => {
        setEditingId(null);
        await loadWorkouts();
    };

    useEffect(() => {
        loadWorkouts();
    }, []);

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Workouts"
                subtitle="Track your training sessions"
            />

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <WorkoutForm
                    className="xl:col-span-3"
                    initialWorkout={editingWorkout}
                    onWorkoutLogged={handleEditComplete}
                    onCancel={() => setEditingId(null)}
                />

                <div className="xl:col-span-2 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">
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
                                onDelete={handleDelete}
                                onUpdate={handleUpdate}
                            />
                        ))}
                    {!isLoading && !error && hasMore && workouts.length > 0 && (
                        <button 
                            onClick={() => loadWorkouts(page + 1)}
                            disabled={isLoadingMore}
                            className="w-full py-3 mt-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover transition-default disabled:opacity-50"
                        >
                            {isLoadingMore ? "Loading..." : "Load More"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
