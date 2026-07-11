import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Load environment variables from .env.local before importing env
dotenv.config({ path: ".env.local" });

import { env } from "../env";
import type { QuestTemplateMongoDoc } from "../lib/data/quests-db";

const INITIAL_QUEST_TEMPLATES: Omit<QuestTemplateMongoDoc, "_id">[] = [
    {
        title: "Daily Burn",
        description: "Log at least 1 workout today.",
        category: "daily",
        metric: "workout_count",
        target: 1,
        xpReward: 100,
        icon: "dumbbell",
        isActive: true,
    },
    {
        title: "Daily Steps",
        description: "Go for a quick 2km run today.",
        category: "daily",
        metric: "run_distance",
        target: 2,
        xpReward: 100,
        icon: "footprints",
        isActive: true,
    },
    {
        title: "Weekly Consistency",
        description: "Log 3 workouts this week.",
        category: "weekly",
        metric: "workout_count",
        target: 3,
        xpReward: 500,
        icon: "calendar",
        isActive: true,
    },
    {
        title: "Marathon Prep",
        description: "Run a total of 15km this week.",
        category: "weekly",
        metric: "run_distance",
        target: 15,
        xpReward: 600,
        icon: "zap",
        isActive: true,
    },
    {
        title: "Weekend Warrior",
        description: "Log 1 run this weekend.",
        category: "special",
        metric: "run_count",
        target: 1,
        xpReward: 300,
        icon: "flame",
        isActive: true,
    }
];

async function seed() {
    const uri = env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not defined");

    console.log("Connecting to MongoDB...");
    const client = new MongoClient(uri);
    await client.connect();

    // Use the explicit database name
    const db = client.db(env.MONGODB_DB);
    const collection = db.collection(env.MONGODB_QUEST_TEMPLATES_COLLECTION);

    console.log("Checking for existing quest templates...");
    const count = await collection.countDocuments();

    if (count > 0) {
        console.log(`Found ${count} quest templates. Skipping seed.`);
    } else {
        console.log("Seeding quest templates...");
        await collection.insertMany(INITIAL_QUEST_TEMPLATES as any);
        console.log("Successfully seeded quest templates!");
    }

    await client.close();
    process.exit(0);
}

seed().catch(console.error);
