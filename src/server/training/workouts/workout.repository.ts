import type { ClientSession } from "mongodb";
import type { IdempotentRecord } from "@/server/platform/http";
import { userScopedRepository, type UserOwnedDoc, type WorkoutDoc } from "@/server/platform/database";
import type { Exercise, Workout } from "@/lib/types";
import type { LiftMax } from "../records/records.rules";
import * as dateQueries from "../dated.repository";
import { dateFilter, type DateRange } from "../dated.repository";

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
        date: new Date(doc.date).toISOString(),
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
    session?: ClientSession,
): Promise<Workout | null> {
    const doc = await workouts.updateById(userId, id, { $set: fields }, { session });
    return doc ? toWorkout(doc) : null;
}

export async function deleteWorkoutById(userId: string, id: string, session?: ClientSession): Promise<Workout | null> {
    const doc = await workouts.deleteById(userId, id, { session });
    return doc ? toWorkout(doc) : null;
}

export function countWorkouts(userId: string, range: DateRange | null, session?: ClientSession): Promise<number> {
    return workouts.count(userId, dateFilter(range), { session });
}

export function findActivityDaysSince(userId: string, from: Date, timeZone: string, session?: ClientSession): Promise<string[]> {
    return dateQueries.findActivityDaysSince(workouts, userId, from, timeZone, session);
}

export function findLatestDate(userId: string, session?: ClientSession): Promise<Date | null> {
    return dateQueries.findLatestDate(workouts, userId, session);
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

const NEWEST_SET_FIRST = { "exercises.weight": -1, _id: -1, exerciseIndex: 1 } as const;

// Ties on weight resolve to the newest workout, then the earliest exercise in it; equal-weight lifts rank by first appearance, newest first.
export function findLiftMaxes(userId: string, limit: number): Promise<LiftMax[]> {
    return workouts.aggregate<LiftMax>(userId, [
        { $unwind: { path: "$exercises", includeArrayIndex: "exerciseIndex" } },
        { $match: { "exercises.weight": { $gt: 0 } } },
        { $addFields: { liftName: { $trim: { input: "$exercises.name" } } } },
        { $addFields: { liftKey: { $toLower: "$liftName" } } },
        { $match: { liftKey: { $ne: "" } } },
        {
            $group: {
                _id: "$liftKey",
                name: { $top: { sortBy: NEWEST_SET_FIRST, output: "$liftName" } },
                weight: { $max: "$exercises.weight" },
                firstSeen: { $top: { sortBy: { _id: -1, exerciseIndex: 1 }, output: { workoutId: "$_id", exerciseIndex: "$exerciseIndex" } } },
            },
        },
        { $sort: { weight: -1, "firstSeen.workoutId": -1, "firstSeen.exerciseIndex": 1 } },
        { $limit: limit },
        { $project: { _id: 0, name: 1, weight: 1 } },
    ]);
}
