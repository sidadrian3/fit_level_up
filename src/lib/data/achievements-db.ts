import { ObjectId } from "mongodb";
import type { Achievement } from "@/lib/types";
import { getCollection } from "@/lib/data/get-collection";
import { ClientSession } from "mongodb";
import type { AchievementCondition } from "@/lib/domain/achievement-rules";

export type AchievementDefinitionDoc = {
    _id?: ObjectId;
    id: string; // e.g. "first_workout"
    title: string;
    description: string;
    icon: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    condition: AchievementCondition;
};

export type UserAchievementDoc = {
    _id?: ObjectId;
    userId: string;
    achievementId: string;
    unlockedDate: string;
};



// // ----------------------------------------------------------------------------
// // SEEDING LOGIC: We define the rules of the game here.
// // ----------------------------------------------------------------------------
// const INITIAL_ACHIEVEMENTS: AchievementDefinitionDoc[] = [
//     {
//         id: "first_workout",
//         title: "First Steps",
//         description: "Complete your first workout",
//         icon: "footprints",
//         rarity: "common",
//         condition: { metric: "total_workouts", target: 1 }
//     },
//     {
//         id: "speed_demon",
//         title: "Speed Demon",
//         description: "Run a total of 5 km",
//         icon: "zap",
//         rarity: "rare",
//         condition: { metric: "total_distance", target: 5 }
//     },
//     {
//         id: "iron_will",
//         title: "Iron Will",
//         description: "Complete 50 workouts",
//         icon: "shield",
//         rarity: "epic",
//         condition: { metric: "total_workouts", target: 50 }
//     },
//     {
//         id: "unstoppable",
//         title: "Unstoppable",
//         description: "Reach a 30-day streak",
//         icon: "flame",
//         rarity: "epic",
//         condition: { metric: "streak", target: 30 }
//     },
//     {
//         id: "legendary_warrior",
//         title: "Legendary Warrior",
//         description: "Reach level 25",
//         icon: "crown",
//         rarity: "legendary",
//         condition: { metric: "level", target: 25 }
//     }
// ];

// Process-level flag: seed only once per server lifecycle, not on every read.



// ----------------------------------------------------------------------------
// DATA ACCESS FUNCTIONS — dumb persistence layer, no business logic
// ----------------------------------------------------------------------------

/** Fetch all achievement definitions (ensures they're seeded first) */
export async function getAchievementDefinitions(): Promise<AchievementDefinitionDoc[]> {
    const collection = await getCollection<AchievementDefinitionDoc>("achievementsCollection");
    return collection.find({}).toArray();
}

/** Fetch all achievement unlock records for a user */
export async function getUserUnlocks(userId: string): Promise<UserAchievementDoc[]> {
    const collection = await getCollection<UserAchievementDoc>("userAchievementsCollection");
    return collection.find({ userId }).toArray();
}

/** Batch insert newly unlocked achievements */
export async function insertUserAchievements(docs: UserAchievementDoc[], session?: ClientSession): Promise<void> {
    const collection = await getCollection<UserAchievementDoc>("userAchievementsCollection");
    await collection.insertMany(docs, { session });
}

/** Fetch all achievements combined with user unlock status — for display */
export async function getAllAchievementsForUser(userId: string): Promise<Achievement[]> {
    const [definitions, unlocks] = await Promise.all([
        getAchievementDefinitions(),
        getUserUnlocks(userId),
    ]);

    // Create a map for fast lookup: achievementId -> UserAchievementDoc
    const unlockedMap = new Map(unlocks.map(u => [u.achievementId, u]));

    // Combine them into the `Achievement` format our UI expects
    return definitions.map(def => {
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
    const collection = await getCollection("userAchievementsCollection");
    return collection.countDocuments({ userId });
}
