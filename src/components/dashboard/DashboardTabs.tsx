"use client";

import { useState } from "react";
import { DailyQuests } from "./DailyQuests";
import { RecentActivity } from "./RecentActivity";
import { MuscleHeatmap } from "./MuscleHeatmap";
import { Quest, Workout } from "@/lib/types";

export function DashboardTabs({ quests, recentWorkouts }: { quests: Quest[], recentWorkouts: Workout[] }) {
    const [activeTab, setActiveTab] = useState<"activity" | "quests" | "heatmap">("activity");

    return (
        <div className="flex flex-col gap-4 mt-6">
            <div className="flex gap-2 bg-background p-1.5 rounded-xl border border-border w-full sm:w-fit overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab("activity")}
                    className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-semibold transition-default ${activeTab === 'activity' ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
                >
                    Recent Activity
                </button>
                <button
                    onClick={() => setActiveTab("quests")}
                    className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-semibold transition-default ${activeTab === 'quests' ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
                >
                    Daily Quests
                </button>
                <button
                    onClick={() => setActiveTab("heatmap")}
                    className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-semibold transition-default ${activeTab === 'heatmap' ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
                >
                    7-Day Heatmap
                </button>
            </div>

            <div className="w-full">
                {activeTab === "activity" && <RecentActivity workouts={recentWorkouts} />}
                {activeTab === "quests" && <DailyQuests quests={quests} />}
                {activeTab === "heatmap" && <MuscleHeatmap />}
            </div>
        </div>
    );
}
