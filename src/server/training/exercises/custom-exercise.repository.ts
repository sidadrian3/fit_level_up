import type { CustomExercise } from "@/shared/contracts/exercise";
import {
    MAX_FIND_LIMIT,
    userScopedRepository,
    type CustomExerciseDoc,
    type UserOwnedDoc,
} from "@/server/platform/database";

type OwnedCustomExerciseDoc = CustomExerciseDoc & UserOwnedDoc;

const customExercises = userScopedRepository<OwnedCustomExerciseDoc>("customExercises");

function toCustomExercise(doc: OwnedCustomExerciseDoc): CustomExercise {
    return {
        id: doc._id.toString(),
        userId: doc.userId,
        name: doc.name,
        targetMuscle: doc.targetMuscle,
    };
}

export async function listCustomExercisesForUser(userId: string): Promise<CustomExercise[]> {
    const docs = await customExercises.find(userId, {}, { limit: MAX_FIND_LIMIT });
    return docs.map(toCustomExercise);
}

export async function insertCustomExercise(input: Omit<CustomExerciseDoc, "_id">): Promise<CustomExercise> {
    const { userId, ...rest } = input;
    return toCustomExercise(await customExercises.insertOne(userId, rest));
}
