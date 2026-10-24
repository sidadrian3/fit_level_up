import type { ClientSession } from "mongodb";
import type { IdempotentRecord } from "@/server/platform/http";
import { userScopedRepository, type UserOwnedDoc, type WorkoutDoc } from "@/server/platform/database";
import type { Exercise, Workout } from "@/lib/types";

type OwnedWorkoutDoc = WorkoutDoc & UserOwnedDoc;

const workouts = userScopedRepository<OwnedWorkoutDoc>("workouts");

const NEWEST_FIRST = { _id: -1 } as const;

function toWorkout(doc: OwnedWorkoutDoc): Workout {
    return {
        id: doc._id.toString(),
        title: doc.title,
        exercises: doc.exercises,
        duration: doc.duration,
        xpEarned: doc.xpEarned,
        date: new Date(doc.date).toISOString().slice(0, 10),
    };
}

export async function listWorkoutsPage(userId: string, page: number, limit: number): Promise<{ data: Workout[]; totalCount: number }> {
    const { items, totalCount } = await workouts.paginate(userId, {}, { page, limit, sort: NEWEST_FIRST });
    return { data: items.map(toWorkout), totalCount };
}

export async function findRecentWorkouts(userId: string, limit: number): Promise<Workout[]> {
    const docs = await workouts.find(userId, {}, { limit, sort: NEWEST_FIRST });
    return docs.map(toWorkout);
}

export async function insertWorkout(
    input: Omit<WorkoutDoc, "_id">,
    session?: ClientSession,
): Promise<Workout> {
    const { userId, ...rest } = input;
    return toWorkout(await workouts.insertOne(userId, rest, { session }));
}

export async function updateWorkoutFields(
    userId: string,
    id: string,
    fields: { title: string; exercises: Exercise[]; duration: number; xpEarned: number },
): Promise<Workout | null> {
    const doc = await workouts.updateById(userId, id, { $set: fields });
    return doc ? toWorkout(doc) : null;
}

export async function deleteWorkoutById(userId: string, id: string): Promise<boolean> {
    return (await workouts.deleteById(userId, id)) !== null;
}

export function countWorkoutsInRange(userId: string, from: Date, toExclusive: Date): Promise<number> {
    return workouts.count(userId, { date: { $gte: from, $lt: toExclusive } });
}

export async function findWorkoutDatesInRange(userId: string, from: Date, toExclusive: Date): Promise<Date[]> {
    const docs = await workouts.aggregate<Pick<WorkoutDoc, "date">>(userId, [
        { $match: { date: { $gte: from, $lt: toExclusive } } },
        { $project: { _id: 0, date: 1 } },
    ]);
    return docs.map((doc) => doc.date);
}

export async function findWorkoutByIdempotencyKey(userId: string, idempotencyKey: string): Promise<IdempotentRecord<Workout> | null> {
    const doc = await workouts.findOne(userId, { idempotencyKey });
    return doc ? { value: toWorkout(doc), fingerprint: doc.idempotencyFingerprint } : null;
}
