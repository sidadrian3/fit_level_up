import type { Achievement } from "@/lib/types";
import { getCollection, type UserAchievementDoc } from "@/server/platform/database";
import { ClientSession } from "mongodb";
import { ACHIEVEMENT_DEFINITIONS } from "@/server/achievements";

// ----------------------------------------------------------------------------
// DATA ACCESS FUNCTIONS — dumb persistence layer, no business logic
// ----------------------------------------------------------------------------

/** Fetch all achievement unlock records for a user */
export async function getUserUnlocks(userId: string): Promise<UserAchievementDoc[]> {
    const collection = await getCollection<UserAchievementDoc>("userAchievements");
    return collection.find({ userId }).toArray();
}

/** Batch-unlock achievements; returns the ids this call actually inserted (a concurrent evaluation may have won) */
export async function insertUserAchievements(docs: UserAchievementDoc[], session?: ClientSession): Promise<Set<string>> {
    const collection = await getCollection<UserAchievementDoc>("userAchievements");
    const result = await collection.bulkWrite(
        docs.map((doc) => ({
            updateOne: {
                filter: { userId: doc.userId, achievementId: doc.achievementId },
                update: { $setOnInsert: doc },
                upsert: true,
            },
        })),
        { session }
    );
    return new Set(Object.keys(result.upsertedIds).map((index) => docs[Number(index)].achievementId));
}

/** Fetch all achievements combined with user unlock status — for display */
export async function getAllAchievementsForUser(userId: string): Promise<Achievement[]> {
    const unlocks = await getUserUnlocks(userId);

    // Create a map for fast lookup: achievementId -> UserAchievementDoc
    const unlockedMap = new Map(unlocks.map(u => [u.achievementId, u]));

    // Combine them into the `Achievement` format our UI expects
    return ACHIEVEMENT_DEFINITIONS.map(def => {
        const unlockRecord = unlockedMap.get(def.id);
        return {
            id: def.id,
            title: def.title,
            description: def.description,
            icon: def.icon,
            rarity: def.rarity,
            unlocked: !!unlockRecord,
            unlockedDate: unlockRecord?.unlockedDate
        };
    });
}

export async function countUserAchievements(userId: string): Promise<number> {
    const collection = await getCollection("userAchievements");
    return collection.countDocuments({ userId });
}
