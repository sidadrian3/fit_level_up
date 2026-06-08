import clientPromise from "@/lib/mongodb";
import type { DashboardStats } from "@/lib/types";
import { DEMO_USER_ID } from "@/lib/constants/demo-user";
import type { UserMongoDoc } from "./user-db";

function getDbConfig() {
    const dbName = process.env.MONGODB_DB;
    const workoutsCollection = process.env.MONGODB_WORKOUTS_COLLECTION;
    const runsCollection = process.env.MONGODB_RUNS_COLLECTION;
    const usersCollection = process.env.MONGODB_USERS_COLLECTION || "users";

    if (!dbName) throw new Error("Missing MONGODB_DB in .env.local");
    if (!workoutsCollection) throw new Error("Missing MONGODB_WORKOUTS_COLLECTION in .env.local");
    if (!runsCollection) throw new Error("Missing MONGODB_RUNS_COLLECTION in .env.local");
    return { dbName, workoutsCollection, runsCollection, usersCollection };
}

function getWeekStartDate() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // How many days since monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday.toISOString().slice(0, 10);
}

export async function getDashboardStatsFromDb(
    userId: string = DEMO_USER_ID
): Promise<DashboardStats> {
    const { dbName, workoutsCollection, runsCollection, usersCollection } = getDbConfig();
    const client = await clientPromise;
    const db = client.db(dbName);

    const weekStart = getWeekStartDate();

    const weeklyWorkouts = await db.collection(workoutsCollection).countDocuments({
        date: {
            $gte: weekStart
        }
    });

    const distanceResult = await db.collection(runsCollection)
        .aggregate([
            {
                $match: {
                    date: {
                        $gte: weekStart
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalDistance: { $sum: "$distance" }
                }
            }
        ]).toArray();

    const weeklyDistance = distanceResult.length > 0
        ? Math.round(distanceResult[0].totalDistance * 10) / 10
        : 0;

    // 3. Get lifetime XP from user document
    const userDoc = await db
        .collection<UserMongoDoc>(usersCollection)
        .findOne({ userId });

    // lifetimeXP = all XP ever earned = (level - 1) worth of XP + current xp
    // Each level N required N*500 XP, so total spent = sum of (1*500 + 2*500 + ... + (level-1)*500)
    let lifetimeXP = 0;
    if (userDoc) {
        for (let i = 1; i < userDoc.level; i++) {
            lifetimeXP += i * 500;
        }
        lifetimeXP += userDoc.xp;
    }

    // 4. Achievements — hardcoded placeholder until Phase 6
    const totalAchievements = 0;
    return {
        weeklyWorkouts,
        weeklyDistance,
        totalAchievements,
        lifetimeXP,
    };

}

