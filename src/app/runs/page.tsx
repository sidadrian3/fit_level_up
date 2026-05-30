"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { RunCard } from "@/components/runs/RunCard";
import { RunForm } from "@/components/runs/RunForm";
import { getRuns } from "@/lib/data/repositories";
import { calcRunStats, formatPace } from "@/lib/utils";
import { MapPin, Activity, Timer } from "lucide-react";

export default function RunsPage() {
    const runs = getRuns();
    const stats = calcRunStats(runs);

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Running 🏃"
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
                <RunForm className="xl:col-span-2" />

                {/* Run history — wider on the right */}
                <div className="xl:col-span-3 space-y-4">
                    <h2 className="text-lg font-bold text-foreground">
                        Run History
                    </h2>
                    {runs.map((run) => (
                        <RunCard key={run.id} run={run} />
                    ))}
                </div>
            </div>
        </div>
    );
}
