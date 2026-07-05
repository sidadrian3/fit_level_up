"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { RunCard } from "@/components/runs/RunCard";
import { RunForm } from "@/components/runs/RunForm";
import { getRuns, deleteRun, updateRun } from "@/lib/data/api-client";
import { calcRunStats, formatPace } from "@/lib/utils";
import { MapPin, Activity, Timer } from "lucide-react";
import type { Run } from "@/lib/types";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";


export default function RunsPage() {
    const queryClient = useQueryClient();

    // 1. Infinite Query for Pagination
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
    } = useInfiniteQuery({
        queryKey: ["runs"],
        queryFn: ({ pageParam = 1 }) => getRuns(pageParam, 5),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            // If the last page returned 5 items, there MIGHT be more.
            return lastPage.length === 5 ? allPages.length + 1 : undefined;
        },
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    // Flatten the pages array into a single list of runs
    const runs = data?.pages.flat() || [];
    const editingRun = runs.find((r) => r.id === editingId);

    const stats = calcRunStats(runs);

    const deleteMutation = useMutation({
        mutationFn: deleteRun,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["runs"] });
            queryClient.invalidateQueries({ queryKey: ["quests"] });
        },
    });

    const handleEditComplete = () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: ["runs"] });
        queryClient.invalidateQueries({ queryKey: ["quests"] });

    };

    const handleUpdate = async (id: string) => {
        setEditingId(id);
    };


    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Running"
                subtitle="Track your runs and pace"
            />

            {/* Top: 3 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <StatCard
                    icon={
                        <MapPin
                            size={24}
                            className="text-accent-blue"
                        />
                    }
                    value={`${stats.totalKm} km`}
                    iconBgColor="bg-accent-blue/10"
                    label="Total Distance"
                />
                <StatCard
                    icon={
                        <Activity
                            size={24}
                            className="text-accent-green"
                        />
                    }
                    value={stats.totalRuns.toString()}
                    label="Total Runs"
                />
                <StatCard
                    icon={
                        <Timer
                            size={24}
                            className="text-accent-purple"
                        />
                    }
                    value={formatPace(stats.avgPace)}
                    iconBgColor="bg-accent-purple/10"
                    label="Avg Pace"
                />
            </div>

            {/* Bottom: Form + Run History */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Form — compact on the left */}
                <RunForm
                    className="xl:col-span-2"
                    initialRun={editingRun}
                    onRunLogged={handleEditComplete}
                    onCancel={() => setEditingId(null)}
                />

                {/* Run history — wider on the right */}
                <div className="xl:col-span-3 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">
                        Run History
                    </h2>
                    {isLoading && (
                        <p className="text-sm text-muted">Loading...</p>
                    )}
                    {isError && (
                        <p className="text-sm text-accent-red">Could not load runs</p>
                    )}
                    {!isLoading &&
                        !isError &&
                        runs.map((run) => (
                            <RunCard
                                key={run.id}
                                run={run}
                                onDelete={(id) => deleteMutation.mutate(id)}
                                onUpdate={handleUpdate}
                            />
                        ))}
                    {!isLoading && !isError && hasNextPage && runs.length > 0 && (
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
