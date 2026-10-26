export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { ProfileHeader } from "./_components/ProfileHeader";
import { AchievementGrid } from "./_components/AchievementGrid";
import { PersonalRecords } from "./_components/PersonalRecords";

import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getUser } from "@/lib/services/users/get-user";
import { getDashboardStats } from "@/server/training";
import { countUnlockedAchievements, listAchievements } from "@/server/achievements";

export default async function ProfilePage() {
    const userId = await getAuthUserId();

    const [user, achievements] = await Promise.all([
        getUser(userId),
        listAchievements(userId)
    ]);

    const stats = await getDashboardStats(userId, user, { countAchievements: countUnlockedAchievements });

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Profile"
                subtitle="View your stats and achievements."
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1 space-y-6">
                    <ProfileHeader user={user} stats={stats} />
                </div>

                <div className="xl:col-span-2">
                    <AchievementGrid achievements={achievements} />
                    <PersonalRecords />
                </div>
            </div>
        </div>
    );
}

