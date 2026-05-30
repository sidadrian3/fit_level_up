import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { AchievementGrid } from "@/components/profile/AchievementGrid";
import { PersonalRecords } from "@/components/profile/PersonalRecords";
import { getUser, getAchievements, getDashboardStats } from "@/lib/data/repositories";

export default function ProfilePage() {
    const user = getUser();
    const achievements = getAchievements();
    const stats = getDashboardStats();

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
