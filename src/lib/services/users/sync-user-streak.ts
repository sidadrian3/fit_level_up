import { getUserFromDb, updateUserStreakInDb } from "@/lib/data/user-db";
import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { calculateStreak } from "@/lib/utils/calculations";

export async function syncUserStreak(userId: string): Promise<void> {
  const user = await getUserFromDb(userId);
  const workouts = await getAllWorkoutsFromDb(userId);
  const runs = await getAllRunsFromDb(userId);

  const allDates = [
    ...workouts.map((w) => w.date),
    ...runs.map((r) => r.date),
  ].filter(Boolean);

  const currentStreak = calculateStreak(allDates);

  if (user.streak !== currentStreak) {
    await updateUserStreakInDb(userId, currentStreak);
  }
}
