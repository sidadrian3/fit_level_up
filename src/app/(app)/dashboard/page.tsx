"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { XPCard } from "@/components/dashboard/XPCard";
import { ActivityTracker } from "@/components/dashboard/ActivityTracker";
import { DailyQuests } from "@/components/dashboard/DailyQuests";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatCard } from "@/components/ui/StatCard";
import { useRouter } from "next/navigation";

import {
    getUser,
    getWorkouts,
    getQuests,
    getDashboardStats
} from "@/lib/data/repositories";
import { Dumbbell, Footprints, Trophy, Zap } from "lucide-react";

import { useState, useEffect } from "react";
import type { Quest, Workout, User, DashboardStats } from "@/lib/types";
import { calcActiveDays } from "@/lib/utils";

export default function DashboardPage() {
    // 1. State for async user and data
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);

    // 2. State for async workouts
    const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
    const [quests, setQuests] = useState<Quest[]>([]);
    const [activeDays, setActiveDays] = useState<boolean[]>([false, false, false, false, false, false, false]);

    const router = useRouter();



    useEffect(() => {
        async function loadWorkouts() {
            try {
                const data = await getWorkouts();
                setRecentWorkouts(data.slice(0, 3));

                // Calculate active days for current week from workouts
                const dates = data.map(w => w.date);
                setActiveDays(calcActiveDays(dates));
            } catch (err) {
                console.error("Failed to load workouts for dashboard", err);
            }
        }

        async function loadQuests() {
            try {
                const data = await getQuests();
                setQuests(data.slice(0, 5));
            } catch (err) {
                console.error("Failed to load quests for dashboard", err);
            }
        }

        async function loadUser() {
            try {
                const data = await getUser();
                setUser(data);
            } catch (err) {
                console.error("Failed to load user for dashboard", err);
            }
        }

        async function loadStats() {
            try {
                const data = await getDashboardStats();
                setStats(data);
            } catch (err) {
                console.error("Failed to load stats for dashboard", err);
            }
        }

        loadUser();
        loadStats();
        loadWorkouts();
        loadQuests();

        const handleUserUpdate = () => { loadUser(); loadStats(); };
        window.addEventListener("user-updated", handleUserUpdate);
        return () => window.removeEventListener("user-updated", handleUserUpdate);
    }, []);

    if (!user || !stats) {
        return (
            <div className="space-y-6 pb-12 animate-pulse">
                <div className="h-20 bg-card rounded-xl w-full"></div>
                <div className="h-64 bg-card rounded-xl w-full"></div>
            </div>
        );
    }

    // 3. Filter and prepare data for the specific components
    const dailyQuests = quests.filter(q => q.category === "daily");

    const workoutDiff = stats.weeklyWorkouts - stats.lastWeekWorkouts;
    let workoutTrendPercent = 0;

    if (stats.lastWeekWorkouts === 0 && stats.weeklyWorkouts > 0) {
        workoutTrendPercent = 100;
    }
    else if (stats.lastWeekWorkouts > 0) {
        workoutTrendPercent = Math.round((workoutDiff / stats.lastWeekWorkouts) * 100);
    }

    const isWorkoutTrendPositive = workoutTrendPercent >= 0;

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title={`Welcome back, ${user.name}!`}
                subtitle="Here's your progress for today."
                actions={[
                    {
                        label: "+ Log Workout",
                        onClick: () => { router.push("/workouts") },
                        variant: "primary"
                    },
                    {
                        label: "+ Log Run",
                        onClick: () => { router.push("/runs") },
                        variant: "secondary"
                    }
                ]}
            />

            {/* Top row: XP Card & 4 Stat Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <XPCard user={user} />

                <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <StatCard
                        icon={<Dumbbell size={24} className="text-accent-green" />}
                        value={stats.weeklyWorkouts.toString()}
                        label="Workouts This Week"
                        trend={{
                            value: Math.abs(workoutTrendPercent),
                            label: "vs last week",
                            isPositive: isWorkoutTrendPositive
                        }}
                    />
                    <StatCard
                        icon={<Footprints size={24} className="text-accent-blue" />}
                        value={`${stats.weeklyDistance} km`}
                        iconBgColor="bg-accent-blue/10"
                        label="Distance This Week"
                    />
                    <StatCard
                        icon={<Trophy size={24} className="text-accent-purple" />}
                        value={stats.totalAchievements.toString()}
                        iconBgColor="bg-accent-purple/10"
                        label="Achievements Unlocked"
                    />
                    <StatCard
                        icon={<Zap size={24} className="text-accent-orange" />}
                        value={stats.lifetimeXP.toLocaleString()}
                        iconBgColor="bg-accent-orange/10"
                        label="Lifetime XP"
                    />
                </div>
            </div>

            {/* Middle row: Activity Tracker Grid */}
            <ActivityTracker activeDays={activeDays} />

            {/* Bottom row: Quests & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <DailyQuests quests={dailyQuests} />
                <RecentActivity workouts={recentWorkouts} />
            </div>
        </div>
    );
}