import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { CreateWorkoutInput, Exercise, Workout } from "@/lib/types";
import { updateQuestProgressFromActivity } from "@/lib/data/quests-db";
import { grantXP, updateUserStats } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/data/achievements-db";

type WorkoutDoc = {
    _id?: ObjectId;
    userId: string;
    type: Workout["type"];
    title: string;
    exercises: Exercise[];
    duration: number;
    xpEarned: number;
    date: string;
};

function getDbConfig() {
    const dbName = process.env.MONGODB_DB;
    const collectionName = process.env.MONGODB_WORKOUTS_COLLECTION;

    if (!dbName) {
        throw new Error("Missing MONGODB_DB in .env.local");
    }
    if (!collectionName) {
        throw new Error("Missing MONGODB_WORKOUTS_COLLECTION in .env.local");
    }

    return { dbName, collectionName };
}

function toWorkout(doc: WorkoutDoc): Workout {
    if (!doc._id) {
        throw new Error("Workout document is missing _id");
    }

    return {
        id: doc._id.toString(),
        type: doc.type,
        title: doc.title,
        exercises: doc.exercises,
        duration: doc.duration,
        xpEarned: doc.xpEarned,
        date: doc.date,
    };
}

function validateInput(input: CreateWorkoutInput): void {
    if (!input.title.trim()) {
        throw new Error("Title is required");
    }
    if (input.duration <= 0) {
        throw new Error("Duration must be greater than 0");
    }

    const namedExercises = input.exercises.filter((ex) => ex.name.trim());
    if (namedExercises.length === 0) {
        throw new Error("Add at least one exercise with a name");
    }
}

function calcXpEarned(duration: number, exerciseCount: number): number {
    return Math.round(duration * 2 + exerciseCount * 15);
}

export async function getAllWorkoutsFromDb(userId: string): Promise<Workout[]> {
    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    const docs = await collection.find({ userId }).sort({ _id: -1 }).toArray();
    return docs.map(toWorkout);
}

export async function addWorkoutToDb(
    input: CreateWorkoutInput,
    userId: string
): Promise<Workout> {
    validateInput(input);

    const namedExercises = input.exercises.filter((ex) => ex.name.trim());

    const docToInsert = {
        userId,
        type: input.type,
        title: input.title.trim(),
        exercises: namedExercises,
        duration: input.duration,
        xpEarned: calcXpEarned(input.duration, namedExercises.length),
        date: new Date().toISOString().slice(0, 10),
    };

    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    const result = await collection.insertOne(docToInsert);

    const createdDoc: WorkoutDoc = {
        _id: result.insertedId,
        ...docToInsert,
    };
    const createdWorkout = toWorkout(createdDoc);

    await updateQuestProgressFromActivity(userId, {
        type: "workout_created",
        xpEarned: createdWorkout.xpEarned,
    });

    await grantXP(userId, createdWorkout.xpEarned);
    await updateUserStats(userId, { incrementWorkouts: 1 });
    await evaluateAchievements(userId);

    return createdWorkout;
}

export async function deleteWorkoutFromDb(id: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
        return false;
    }

    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    const result = await collection.deleteOne({ _id: new ObjectId(id), userId });
    return result.deletedCount === 1;
}

export async function updateWorkoutInDb(id: string, input: CreateWorkoutInput, userId: string): Promise<Workout | null> {
    if (!ObjectId.isValid(id)) {
        return null;
    }

    validateInput(input);

    const namedExercises = input.exercises.filter((ex) => ex.name.trim());

    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    // Fetch original to preserve date
    const existing = await collection.findOne({ _id: new ObjectId(id), userId });
    if (!existing) {
        return null;
    }

    const updatedDoc = {
        type: input.type,
        title: input.title.trim(),
        exercises: namedExercises,
        duration: input.duration,
        xpEarned: calcXpEarned(input.duration, namedExercises.length),
        date: existing.date,  //Keep original date
    };

    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updatedDoc },
        { returnDocument: "after" }
    );

    if (!result) {
        return null;
    }

    return toWorkout(result);
}