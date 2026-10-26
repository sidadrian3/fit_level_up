"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { RunCard } from "@/components/runs/RunCard";
import { RunForm } from "@/components/runs/RunForm";
import { useRuns } from "@/lib/runs/hooks/useRuns";
import { useRunStats } from "@/lib/runs/hooks/useRunStats";
import { useDeleteRun } from "@/lib/runs/hooks/useDeleteRun";
import { formatPace } from "@/lib/utils";
import { MapPin, Activity, Timer } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";


export default function RunsPage() {
    const [page, setPage] = useState(1);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data, isLoading, isError } = useRuns(page, 4);
    const { data: statsData } = useRunStats();
    const deleteMutation = useDeleteRun();

    const runs = data?.data || [];
    const editingRun = runs.find((r) => r.id === editingId);
    const stats = statsData || { totalKm: 0, totalRuns: 0, avgPace: 0 };

    const handleEditComplete = () => {
        setEditingId(null);
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
