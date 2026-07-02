import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const INITIAL_ACHIEVEMENTS = [
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

async function seed() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not defined");

    console.log("Connecting to MongoDB...");
    const client = new MongoClient(uri);
    await client.connect();

    // We assume the DB name is "fit_level_up" as defined in your db-config
    const db = client.db("fit_level_up");
    const collection = db.collection("achievements");

    console.log("Checking for existing achievements...");
    const count = await collection.countDocuments();

    if (count > 0) {
        console.log(`Found ${count} achievements. Skipping seed.`);
    } else {
        console.log("Seeding achievements...");
        await collection.insertMany(INITIAL_ACHIEVEMENTS);
        console.log("Successfully seeded achievements!");
    }

    await client.close();
    process.exit(0);
}

seed().catch(console.error);
