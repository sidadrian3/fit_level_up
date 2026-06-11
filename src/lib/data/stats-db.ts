import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { DashboardStats } from "@/lib/types";
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

function getLastWeekBoundaries() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() + diff - 7);
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() + diff - 1);

    return {
        lastMonday: lastMonday.toISOString().slice(0, 10),
        lastSunday: lastSunday.toISOString().slice(0, 10)
    }
}

export async function getDashboardStatsFromDb(
    userId: string
): Promise<DashboardStats> {
    const { dbName, workoutsCollection, runsCollection, usersCollection } = getDbConfig();
    const client = await clientPromise;
    const db = client.db(dbName);

    const weekStart = getWeekStartDate();

    const weeklyWorkouts = await db.collection(workoutsCollection).countDocuments({
        userId,
        date: {
            $gte: weekStart
        }
    });

    const lastWeek = getLastWeekBoundaries();
    const lastWeekWorkouts = await db.collection(workoutsCollection).countDocuments({
        userId,
        date: {
            $gte: lastWeek.lastMonday,
            $lte: lastWeek.lastSunday
        }
    });

    const distanceResult = await db.collection(runsCollection)
        .aggregate([
            {
                $match: {
                    userId,
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
        .findOne({ _id: new ObjectId(userId) });

    // lifetimeXP = all XP ever earned = (level - 1) worth of XP + current xp
    // Each level N required N*500 XP, so total spent = sum of (1*500 + 2*500 + ... + (level-1)*500)
    let lifetimeXP = 0;
    if (userDoc) {
        const level = userDoc.level || 1;
        const xp = userDoc.xp || 0;
        for (let i = 1; i < level; i++) {
            lifetimeXP += i * 500;
        }
        lifetimeXP += xp;
    }

    // 4. Count unlocked achievements
    const userAchievementsCollection = process.env.MONGODB_USER_ACHIEVEMENTS_COLLECTION || "user_achievements";
    const totalAchievements = await db.collection(userAchievementsCollection).countDocuments({ userId });

    return {
        weeklyWorkouts,
        lastWeekWorkouts,
        weeklyDistance,
        totalAchievements,
        lifetimeXP,
    };

}

