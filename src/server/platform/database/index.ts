import "server-only";

export { client, clientPromise } from "./client";
export { getCollection, getDb } from "./get-collection";
export { applySchema } from "./apply-schema";
export { COLLECTIONS } from "./schema";
export type {
    CollectionKey,
    WorkoutDoc,
    RunDoc,
    CustomExerciseDoc,
    WorkoutTemplateDoc,
    UserQuestDoc,
    UserAchievementDoc,
    FriendshipDoc,
    UserDoc,
} from "./schema";
