export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/layout/PageHeader";
import { XPCard } from "@/components/dashboard/XPCard";
import { ActivityTracker } from "@/components/dashboard/ActivityTracker";
import { DailyQuests } from "@/components/dashboard/DailyQuests";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { StatCard } from "@/components/ui/StatCard";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { getDashboardStats } from "@/lib/services/users/get-dashboard-stats";
import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { getUserQuests } from "@/lib/services/quests/get-user-quests";
import { Dumbbell, Footprints, Trophy, Zap } from "lucide-react";
import { calcActiveDays } from "@/lib/domain/user-rules";


export default async function DashboardPage() {

    const userId = await getAuthUserId();

    const [user, allWorkouts, allQuests] = await
        Promise.all([
            UserStateService.getUser(userId),
            getAllWorkoutsFromDb(userId),
            getUserQuests(userId)
        ]);
    const stats = await getDashboardStats(userId, user);

    const recentWorkouts = allWorkouts.slice(0, 3);
    const dates = allWorkouts.map(w => w.date);
    const activeDays = calcActiveDays(dates);

    // Filter for daily quests first, then limit to top 5
    const dailyQuests = allQuests.filter(q => q.category === "daily").slice(0, 5);

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
                        href: "/workouts",
                        variant: "primary"
                    },
                    {
                        label: "+ Log Run",
                        href: "/runs",
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

            {/* Bottom row: Tabbed Quests, Activity, Heatmap */}
            <DashboardTabs quests={dailyQuests} recentWorkouts={recentWorkouts} />
        </div>
    );
}