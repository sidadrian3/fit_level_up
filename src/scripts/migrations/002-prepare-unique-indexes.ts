import type { Db, Document, ObjectId } from "mongodb";
import { COLLECTIONS, type CollectionKey } from "@/server/platform/database";
import type { Migration } from "./run-migrations";

type FriendshipCandidate = { _id: ObjectId; status: string; updatedAt: Date; createdAt: Date };
type UserQuestCandidate = { _id: ObjectId; claimed: boolean; progress: number };

// Accepted friendships win; otherwise the most recently touched document does
function pickFriendshipToKeep(docs: FriendshipCandidate[]): ObjectId {
  const ranked = [...docs].sort((a, b) => {
    if ((a.status === "accepted") !== (b.status === "accepted")) return a.status === "accepted" ? -1 : 1;
    return (b.updatedAt ?? b.createdAt).getTime() - (a.updatedAt ?? a.createdAt).getTime();
  });
  return ranked[0]._id;
}

function pickUserQuestToKeep(docs: UserQuestCandidate[]): ObjectId {
  const ranked = [...docs].sort((a, b) => {
    if (a.claimed !== b.claimed) return a.claimed ? -1 : 1;
    return b.progress - a.progress;
  });
  return ranked[0]._id;
}

// The pipeline sorts oldest-first, so the first document is the one to keep
function firstDocument(docs: { _id: ObjectId }[]): ObjectId {
  return docs[0]._id;
}

const PAIR_KEY_EXPRESSION = {
  $cond: [
    { $lt: ["$requesterId", "$receiverId"] },
    { $concat: ["$requesterId", ":", "$receiverId"] },
    { $concat: ["$receiverId", ":", "$requesterId"] },
  ],
};

async function removeDuplicateGroups<T extends { _id: ObjectId }>(
  db: Db,
  collectionKey: CollectionKey,
  groupKey: Document | string,
  pickKeeper: (docs: T[]) => ObjectId,
  projection: Document,
  pipelinePrefix: Document[] = []
): Promise<number> {
  const collection = db.collection(COLLECTIONS[collectionKey]);
  const groups = await collection
    .aggregate<{ docs: T[] }>([
      ...pipelinePrefix,
      { $group: { _id: groupKey, docs: { $push: projection }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ], { allowDiskUse: true })
    .toArray();

  let removed = 0;
  for (const group of groups) {
    const keep = pickKeeper(group.docs);
    const toDelete = group.docs.map((doc) => doc._id).filter((id) => !id.equals(keep));
    removed += (await collection.deleteMany({ _id: { $in: toDelete } })).deletedCount;
  }
  return removed;
}

async function dropNonUniqueIndex(db: Db, collectionKey: CollectionKey, indexName: string): Promise<void> {
  const collection = db.collection(COLLECTIONS[collectionKey]);
  const existing = (await collection.indexes().catch(() => [])).find((index) => index.name === indexName);
  if (existing && !existing.unique) {
    await collection.dropIndex(indexName);
  }
}

// Unique indexes cannot build over existing duplicates, so this must run before applySchema. Safe to re-run.
async function prepareUniqueIndexes(db: Db): Promise<void> {
  const duplicateUnlocks = await removeDuplicateGroups(
    db,
    "userAchievements",
    { userId: "$userId", achievementId: "$achievementId" },
    firstDocument,
    { _id: "$_id" },
    [{ $sort: { unlockedDate: 1, _id: 1 } }]
  );

  const duplicateExercises = await removeDuplicateGroups(
    db,
    "customExercises",
    { userId: "$userId", name: "$name", targetMuscle: "$targetMuscle" },
    firstDocument,
    { _id: "$_id" },
    [{ $sort: { _id: 1 } }]
  );

  const duplicateQuestRows = await removeDuplicateGroups(
    db,
    "userQuests",
    { userId: "$userId", questTemplateId: "$questTemplateId", periodStart: "$periodStart", periodEnd: "$periodEnd" },
    pickUserQuestToKeep,
    { _id: "$_id", claimed: "$claimed", progress: "$progress" }
  );

  const duplicateFriendships = await removeDuplicateGroups(
    db,
    "friendships",
    "$pairKey",
    pickFriendshipToKeep,
    { _id: "$_id", status: "$status", updatedAt: "$updatedAt", createdAt: "$createdAt" },
    [{ $addFields: { pairKey: PAIR_KEY_EXPRESSION } }]
  );

  const friendships = db.collection(COLLECTIONS.friendships);
  await friendships.updateMany({ pairKey: { $exists: false } }, [{ $set: { pairKey: PAIR_KEY_EXPRESSION } }]);

  await dropNonUniqueIndex(db, "userQuests", "idx_userQuests_sync_lookup");

  console.log(
    `Unique-index prep: removed ${duplicateUnlocks} duplicate unlocks, ${duplicateExercises} duplicate custom exercises, ` +
    `${duplicateQuestRows} duplicate quest rows, ${duplicateFriendships} duplicate friendships.`
  );
}

export const prepareUniqueIndexesMigration: Migration = {
  name: "002-prepare-unique-indexes",
  up: prepareUniqueIndexes,
};
