// "use client";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { AchievementGrid } from "@/components/profile/AchievementGrid";
import { PersonalRecords } from "@/components/profile/PersonalRecords";

import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getUser } from "@/lib/services/users/get-user";
import { getDashboardStats } from "@/lib/services/users/get-dashboard-stats";
import { getAllAchievementsForUser } from "@/lib/data/achievements-db";

import type { Achievement, DashboardStats, User } from "@/lib/types";

export default async function ProfilePage() {
    const userId = await getAuthUserId();

    const [user, stats, achievements] = await Promise.all([
        getUser(userId),
        getDashboardStats(userId),
        getAllAchievementsForUser(userId)
    ]);

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Profile 👤"
                subtitle="View your stats and achievements."
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1 space-y-6">
                    <ProfileHeader user={user} stats={stats} />
                    <PersonalRecords />
                </div>

                <div className="xl:col-span-2">
                    <AchievementGrid achievements={achievements} />
                </div>
            </div>
        </div>
    );
}

