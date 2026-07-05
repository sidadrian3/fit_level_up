"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { WorkoutForm } from "@/components/workouts/WorkoutForm";
import { getWorkouts, deleteWorkout } from "@/lib/data/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/ui/Pagination";

export default function WorkoutsPage() {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    // 1. Pagination Query
    const {
        data,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["workouts", page],
        queryFn: () => getWorkouts(page, 4),
    });

    // Get workouts from paginated response
    const workouts = data?.data || [];
    const editingWorkout = workouts.find((w) => w.id === editingId);

    const deleteMutation = useMutation({
        mutationFn: deleteWorkout,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workouts"] });
            queryClient.invalidateQueries({ queryKey: ["quests"] });
            queryClient.invalidateQueries({ queryKey: ["personal-records"] });
        },
    });

    const handleEditComplete = () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: ["workouts"] });
        queryClient.invalidateQueries({ queryKey: ["quests"] });
        queryClient.invalidateQueries({ queryKey: ["personal-records"] });
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

                    {!isLoading && !isError && data && (
                        <Pagination
                            currentPage={page}
                            totalPages={data.totalPages}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
