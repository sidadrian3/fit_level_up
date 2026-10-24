import "server-only";

export { client, clientPromise } from "./client";
export { collectionExists, getCollection, getDb } from "./get-collection";
export { isDuplicateKeyError, parseObjectId } from "./mongo-utils";
export { MAX_FIND_LIMIT, userScopedRepository } from "./user-scoped-repository";
export type { ScopedFilter, UserOwnedDoc, UserScopedRepository } from "./user-scoped-repository";
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
    OutboxDoc,
    PlayerProfileDoc,
    XpLedgerDoc,
    XpSourceType,
} from "./schema";
