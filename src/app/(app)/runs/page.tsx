"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { RunCard } from "@/components/runs/RunCard";
import { RunForm } from "@/components/runs/RunForm";
import { getRuns, deleteRun, updateRun } from "@/lib/data/api-client";
import { calcRunStats, formatPace } from "@/lib/utils";
import { MapPin, Activity, Timer } from "lucide-react";
import type { Run } from "@/lib/types";

export default function RunsPage() {
    const [runs, setRuns] = useState<Run[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const editingRun = runs.find(r => r.id === editingId);
    const stats = calcRunStats(runs);

    async function loadRuns() {
        try {
            setError(null);
            setIsLoading(true);
            const data = await getRuns();
            setRuns([...data]);
        } catch {
            setError("Could not load runs");
        } finally {
            setIsLoading(false);
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteRun(id);
            await loadRuns();
        } catch (err) {
            console.error("Delete failed:", err);
            setError("Failed to delete run");
        }
    };

    const handleUpdate = async (id: string) => {
        setEditingId(id);
    };

    const handleEditComplete = async () => {
        setEditingId(null);
        await loadRuns();
    };

    useEffect(() => {
        loadRuns();
    }, []);

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
                    {error && (
                        <p className="text-sm text-accent-red">{error}</p>
                    )}
                    {!isLoading &&
                        !error &&
                        runs.map((run) => (
                            <RunCard 
                                key={run.id} 
                                run={run}
                                onDelete={handleDelete}
                                onUpdate={handleUpdate}
                            />
                        ))}
                </div>
            </div>
        </div>
    );
}
