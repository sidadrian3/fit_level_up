import { ACHIEVEMENT_DEFINITIONS } from "@/shared/achievement-definitions";
import { getPlayerState } from "@/server/progression";
import { defineListener, emit, type AnyListener } from "@/server/platform/events";
import { clientPromise } from "@/server/platform/database";
import { findNewUnlocks } from "./achievement.rules";
import { findUnlocks, upsertUnlocks } from "./achievement.repository";
import "./events";

export async function evaluateAchievements(userId: string, now: Date = new Date()): Promise<string[]> {
  const player = await getPlayerState(userId, { now });
  const unlocked = await findUnlocks(userId);
  const unlockedIds = new Set(unlocked.map((unlock) => unlock.achievementId));

  const candidates = findNewUnlocks(ACHIEVEMENT_DEFINITIONS, unlockedIds, player);
  if (candidates.length === 0) return [];

  const client = await clientPromise;
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const inserted = await upsertUnlocks(userId, candidates, now.toISOString(), session);
      for (const achievementId of inserted) {
        await emit("achievement.unlocked", { userId, achievementId }, { session });
      }
      return inserted;
    });
  } finally {
    await session.endSession();
  }
}

export const achievementListeners: AnyListener[] = [
  defineListener({
    name: "achievements.evaluate",
    event: "activity.logged",
    handle: async ({ userId }) => {
      await evaluateAchievements(userId);
    },
  }),
  defineListener({
    name: "achievements.evaluate",
    event: "progression.leveled-up",
    handle: async ({ userId }) => {
      await evaluateAchievements(userId);
    },
  }),
];
