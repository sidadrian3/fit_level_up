"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { WorkoutForm } from "@/components/workouts/WorkoutForm";
import { getWorkouts, deleteWorkout } from "@/lib/data/api-client";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function WorkoutsPage() {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);

    // 1. Infinite Query for Pagination
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
    } = useInfiniteQuery({
        queryKey: ["workouts"],
        queryFn: ({ pageParam = 1 }) => getWorkouts(pageParam, 5),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            // If the last page returned 5 items, there MIGHT be more.
            return lastPage.length === 5 ? allPages.length + 1 : undefined;
        },
    });

    // Flatten the pages array into a single list of workouts
    const workouts = data?.pages.flat() || [];
    const editingWorkout = workouts.find((w) => w.id === editingId);

    const deleteMutation = useMutation({
        mutationFn: deleteWorkout,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workouts"] });
            queryClient.invalidateQueries({ queryKey: ["quests"] });
        },
    });

    const handleEditComplete = () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: ["workouts"] });
        queryClient.invalidateQueries({ queryKey: ["quests"] });

    };

    return (
        <div className="space-y-6 pb-12">
            <PageHeader title="Workouts" subtitle="Track your training sessions" />

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <WorkoutForm
                    className="xl:col-span-3"
                    initialWorkout={editingWorkout}
                    onWorkoutLogged={handleEditComplete}
                    onCancel={() => setEditingId(null)}
                />

                <div className="xl:col-span-2 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Workout History</h2>

                    {isLoading && <p className="text-sm text-muted">Loading...</p>}
                    {isError && <p className="text-sm text-accent-red">Could not load workouts</p>}

                    {!isLoading && !isError && workouts.map((workout) => (
                        <WorkoutCard
                            key={workout.id}
                            workout={workout}
                            onDelete={(id) => deleteMutation.mutate(id)}
                            onUpdate={(id) => setEditingId(id)}
                        />
                    ))}

                    {hasNextPage && (
                        <button
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            className="w-full py-3 mt-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover transition-default disabled:opacity-50"
                        >
                            {isFetchingNextPage ? "Loading..." : "Load More"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
