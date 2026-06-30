import { getMondayDateString, getLastWeekBoundaries } from "@/lib/utils/dates";
import { countWorkoutsInRange } from "@/lib/data/workout-db";
import { getTotalDistanceInRange } from "@/lib/data/runs-db";
import { countUserAchievements } from "@/lib/data/achievements-db";
import { getUser } from "@/lib/services/users/get-user";
import { calcLifetimeXp } from "@/lib/domain/user-rules";
import type { DashboardStats } from "@/lib/types";

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
    const weekStart = getMondayDateString();
    const { lastMonday, lastSunday } = getLastWeekBoundaries();

    // Fire all DB queries concurrently for maximum performance
    const [
        weeklyWorkouts,
        lastWeekWorkouts,
        weeklyDistance,
        totalAchievements,
        user
    ] = await Promise.all([
        countWorkoutsInRange(userId, weekStart),
        countWorkoutsInRange(userId, lastMonday, lastSunday),
        getTotalDistanceInRange(userId, weekStart),
        countUserAchievements(userId),
        getUser(userId)
    ]);

    const lifetimeXP = calcLifetimeXp(user.level, user.xp);

    return {
        weeklyWorkouts,
        lastWeekWorkouts,
        weeklyDistance,
        totalAchievements,
        lifetimeXP,
    };
}
