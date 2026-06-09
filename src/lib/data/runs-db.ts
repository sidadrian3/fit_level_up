import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { CreateRunInput, Run } from "@/lib/types";
import { updateQuestProgressFromActivity } from "@/lib/data/quests-db";
import { grantXP, updateUserStats } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/data/achievements-db";

type RunDoc = {
    _id?: ObjectId;
    userId: string;
    distance: number;
    duration: number;
    pace: number;
    difficulty: Run["difficulty"];
    xpEarned: number;
    date: string;
}

function getDbConfig() {
    const dbName = process.env.MONGODB_DB;
    const collectionName = process.env.MONGODB_RUNS_COLLECTION;

    if (!dbName) {
        throw new Error("Missing MONGODB_DB in .env.local");
    }
    if (!collectionName) {
        throw new Error("Missing MONGODB_RUNS_COLLECTION in .env.local");
    }

    return { dbName, collectionName };
}

function toRun(doc: RunDoc): Run {
    if (!doc._id) {
        throw new Error("Run document is missing _id");
    }
    return {
        id: doc._id.toString(),
        distance: doc.distance,
        duration: doc.duration,
        pace: doc.pace,
        difficulty: doc.difficulty,
        xpEarned: doc.xpEarned,
        date: doc.date
    };
}

function validateInput(input: CreateRunInput): void {
    if (input.distance <= 0) {
        throw new Error("Distance must be greater than 0");
    }

    if (input.duration <= 0) {
        throw new Error("Duration must be greater than 0");
    }

    // if (!["easy", "moderate", "hard", "intense"].includes(input.difficulty)) {
    //     throw new Error("Invalid difficulty level");
    // }

}

function calcXpEarned(distance: number, duration: number, difficulty: Run["difficulty"]): number {
    const baseXp = Math.round(distance * 10 + duration * 2);
    const difficultyMultiplier = {
        easy: 1,
        moderate: 1.2,
        hard: 1.5,
        intense: 2
    }[difficulty] || 1;
    return Math.round(baseXp * difficultyMultiplier);
}

function calcPace(distance: number, duration: number): number {
    return duration / distance;
}

export async function getAllRunsFromDb(userId: string): Promise<Run[]> {
    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const docs = await collection.find({ userId }).sort({ _id: -1 }).toArray();
    return docs.map(toRun);
}

export async function addRunToDb(
    input: CreateRunInput,
    userId: string
): Promise<Run> {
    validateInput(input);



    const docToInsert = {
        userId,
        distance: input.distance,
        duration: input.duration,
        pace: calcPace(input.distance, input.duration),
        difficulty: input.difficulty,
        xpEarned: calcXpEarned(input.distance, input.duration, input.difficulty),
        date: new Date().toISOString().slice(0, 10),
    }

    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const result = await collection.insertOne(docToInsert);

    const createdDoc: RunDoc = {
        _id: result.insertedId,
        ...docToInsert,
    };

    const createdRun = toRun(createdDoc);
    await updateQuestProgressFromActivity(userId, {
        type: "run_created",
        distance: createdRun.distance,
        xpEarned: createdRun.xpEarned,
    });

    await grantXP(userId, createdRun.xpEarned);
    await updateUserStats(userId, { incrementDistance: createdRun.distance });
    await evaluateAchievements(userId);

    return createdRun
}

export async function deleteRunFromDb(id: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
        return false;
    }
    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const result = await collection.deleteOne({ _id: new ObjectId(id), userId });
    return result.deletedCount === 1;
}

export async function updateRunInDb(id: string, input: CreateRunInput, userId: string): Promise<Run | null> {
    if (!ObjectId.isValid(id)) {
        return null;
    }

    validateInput(input);

    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const existing = await collection.findOne({ _id: new ObjectId(id), userId });
    if (!existing) {
        return null;
    }

    const updateDoc = {
        distance: input.distance,
        duration: input.duration,
        pace: calcPace(input.distance, input.duration),
        difficulty: input.difficulty,
        xpEarned: calcXpEarned(input.distance, input.duration, input.difficulty),
        date: existing.date, // Preserve original date
    };

    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateDoc },
        { returnDocument: "after" }
    );

    if (!result) {
        return null;
    }

    return toRun(result);
}