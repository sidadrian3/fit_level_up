import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Achievement } from "@/lib/types";
import { getUser } from "@/lib/services/get-user";

export type AchievementCondition = {
    metric: "total_workouts" | "total_distance" | "level" | "streak";
    target: number;
};

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

function getDbConfig() {
    const dbName = process.env.MONGODB_DB;
    const definitionsCollection = process.env.MONGODB_ACHIEVEMENT_DEFINITIONS_COLLECTION || "achievement_definitions";
    const userAchievementsCollection = process.env.MONGODB_USER_ACHIEVEMENTS_COLLECTION || "user_achievements";

    if (!dbName) throw new Error("Missing MONGODB_DB in .env.local");

    return { dbName, definitionsCollection, userAchievementsCollection };
}

// ----------------------------------------------------------------------------
// SEEDING LOGIC: We define the rules of the game here.
// ----------------------------------------------------------------------------
const INITIAL_ACHIEVEMENTS: AchievementDefinitionDoc[] = [
    {
        id: "first_workout",
        title: "First Steps",
        description: "Complete your first workout",
        icon: "footprints",
        rarity: "common",
        condition: { metric: "total_workouts", target: 1 }
    },
    {
        id: "speed_demon",
        title: "Speed Demon",
        description: "Run a total of 5 km",
        icon: "zap",
        rarity: "rare",
        condition: { metric: "total_distance", target: 5 }
    },
    {
        id: "iron_will",
        title: "Iron Will",
        description: "Complete 50 workouts",
        icon: "shield",
        rarity: "epic",
        condition: { metric: "total_workouts", target: 50 }
    },
    {
        id: "unstoppable",
        title: "Unstoppable",
        description: "Reach a 30-day streak",
        icon: "flame",
        rarity: "epic",
        condition: { metric: "streak", target: 30 }
    },
    {
        id: "legendary_warrior",
        title: "Legendary Warrior",
        description: "Reach level 25",
        icon: "crown",
        rarity: "legendary",
        condition: { metric: "level", target: 25 }
    }
];

export async function ensureAchievementDefinitions() {
    const { dbName, definitionsCollection } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<AchievementDefinitionDoc>(definitionsCollection);

    // If we already have definitions, don't seed again.
    const count = await collection.countDocuments();
    if (count > 0) return;

    await collection.insertMany(INITIAL_ACHIEVEMENTS);
    console.log("Seeded initial achievement definitions.");
}

// ----------------------------------------------------------------------------
// FETCH LOGIC
// ----------------------------------------------------------------------------
export async function getAllAchievementsForUser(userId: string): Promise<Achievement[]> {
    await ensureAchievementDefinitions(); // Make sure templates exist

    const { dbName, definitionsCollection, userAchievementsCollection } = getDbConfig();
    const client = await clientPromise;
    const db = client.db(dbName);

    // 1. Fetch all definitions
    const definitions = await db.collection<AchievementDefinitionDoc>(definitionsCollection).find({}).toArray();

    // 2. Fetch all user unlocks
    const unlocks = await db.collection<UserAchievementDoc>(userAchievementsCollection).find({ userId }).toArray();

    // Create a map for fast lookup: achievementId -> UserAchievementDoc
    const unlockedMap = new Map(unlocks.map(u => [u.achievementId, u]));

    // 3. Combine them into the `Achievement` format our UI expects
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


export async function evaluateAchievements(userId: string): Promise<Achievement[]> {
    await ensureAchievementDefinitions();

    const { dbName, definitionsCollection, userAchievementsCollection } = getDbConfig();
    const client = await clientPromise;
    const db = client.db(dbName);

    //Fetch user to check their stats
    const user = await getUser(userId);

    //Fetch all achievement definitions
    const definitions = await db.collection<AchievementDefinitionDoc>(definitionsCollection).find({}).toArray();

    //Fetch what the user has already unlocked
    const unlocked = await db.collection<UserAchievementDoc>(userAchievementsCollection).find({ userId }).toArray();
    const unlockedIds = new Set(unlocked.map(u => u.achievementId));

    //Filter down to the ones they HAVEN'T unlocked yet
    const lockedDefinitions = definitions.filter(def => !unlockedIds.has(def.id));

    //Evaluate conditions
    const newlyUnlockedDocs: UserAchievementDoc[] = [];
    const newlyUnlockedAchievements: Achievement[] = [];

    const now = new Date().toISOString();

    for (const def of lockedDefinitions) {
        let conditionMet = false;

        switch (def.condition.metric) {
            case "total_workouts":
                conditionMet = user.totalWorkouts >= def.condition.target;
                break;
            case "total_distance":
                conditionMet = user.totalDistance >= def.condition.target;
                break;
            case "level":
                conditionMet = user.level >= def.condition.target;
                break;
            case "streak":
                conditionMet = user.streak >= def.condition.target;
                break;
        }

        if (conditionMet) {
            newlyUnlockedDocs.push({
                userId,
                achievementId: def.id,
                unlockedDate: now
            });

            newlyUnlockedAchievements.push({
                id: def.id,
                title: def.title,
                description: def.description,
                icon: def.icon,
                rarity: def.rarity,
                unlocked: true,
                unlockedDate: now
            });
        }
    }

    // 6. If we found new unlocks, save them to the database
    if (newlyUnlockedDocs.length > 0) {
        await db.collection<UserAchievementDoc>(userAchievementsCollection).insertMany(newlyUnlockedDocs);
        console.log(`User ${userId} unlocked ${newlyUnlockedDocs.length} new achievements!`);
    }

    return newlyUnlockedAchievements;
}

