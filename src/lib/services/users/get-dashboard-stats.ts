import { getMondayDateString, getLastWeekBoundaries } from "@/lib/utils/dates";
import { countWorkoutsInRange } from "@/lib/data/workout-db";
import { getTotalDistanceInRange } from "@/lib/data/runs-db";
import { countUserAchievements } from "@/lib/data/achievements-db";
import { calcLifetimeXp } from "@/lib/domain/user-rules";
import type { DashboardStats, User } from "@/lib/types";

export async function getDashboardStats(userId: string, user: User): Promise<DashboardStats> {
    const weekStart = getMondayDateString();
    const { lastMonday, lastSunday } = getLastWeekBoundaries();

    // Fire all DB queries concurrently for maximum performance
    const [
        weeklyWorkouts,
        lastWeekWorkouts,
        weeklyDistance,
        totalAchievements,
    ] = await Promise.all([
        countWorkoutsInRange(userId, weekStart),
        countWorkoutsInRange(userId, lastMonday, lastSunday),
        getTotalDistanceInRange(userId, weekStart),
        countUserAchievements(userId),
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
