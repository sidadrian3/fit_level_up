import { addDays, startOfLocalDay, startOfWeek, toLocalDay } from "@/lib/utils/dates";
import { countWorkoutsInRange } from "@/lib/data/workout-db";
import { getTotalDistanceInRange } from "@/lib/data/runs-db";
import { countUserAchievements } from "@/lib/data/achievements-db";
import { calcLifetimeXp } from "@/lib/domain/user-rules";
import type { DashboardStats, User } from "@/lib/types";

export async function getDashboardStats(userId: string, user: User): Promise<DashboardStats> {
    const timeZone = user.timeZone;
    const weekStart = startOfWeek(toLocalDay(new Date(), timeZone));
    const lastWeekFrom = startOfLocalDay(addDays(weekStart, -7), timeZone);
    const thisWeekFrom = startOfLocalDay(weekStart, timeZone);
    const nextWeekFrom = startOfLocalDay(addDays(weekStart, 7), timeZone);

    // Fire all DB queries concurrently for maximum performance
    const [
        weeklyWorkouts,
        lastWeekWorkouts,
        weeklyDistance,
        totalAchievements,
    ] = await Promise.all([
        countWorkoutsInRange(userId, thisWeekFrom, nextWeekFrom),
        countWorkoutsInRange(userId, lastWeekFrom, thisWeekFrom),
        getTotalDistanceInRange(userId, thisWeekFrom, nextWeekFrom),
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
