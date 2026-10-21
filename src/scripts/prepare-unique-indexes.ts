import type { Document, ObjectId } from "mongodb";
import { getCollection } from "../lib/data/get-collection";

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
  collectionKey: Parameters<typeof getCollection>[0],
  groupKey: Document | string,
  pickKeeper: (docs: T[]) => ObjectId,
  projection: Document,
  pipelinePrefix: Document[] = []
): Promise<number> {
  const collection = await getCollection(collectionKey);
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

async function dropNonUniqueIndex(collectionKey: Parameters<typeof getCollection>[0], indexName: string): Promise<void> {
  const collection = await getCollection(collectionKey);
  const existing = (await collection.indexes().catch(() => [])).find((index) => index.name === indexName);
  if (existing && !existing.unique) {
    await collection.dropIndex(indexName);
  }
}

// Unique indexes cannot build over existing duplicates, so this must run before ensureIndexes. Safe to re-run.
export async function prepareUniqueIndexes(): Promise<void> {
  const duplicateUnlocks = await removeDuplicateGroups(
    "userAchievementsCollection",
    { userId: "$userId", achievementId: "$achievementId" },
    firstDocument,
    { _id: "$_id" },
    [{ $sort: { unlockedDate: 1, _id: 1 } }]
  );

  const duplicateExercises = await removeDuplicateGroups(
    "customExercisesCollection",
    { userId: "$userId", name: "$name", targetMuscle: "$targetMuscle" },
    firstDocument,
    { _id: "$_id" },
    [{ $sort: { _id: 1 } }]
  );

  const duplicateQuestRows = await removeDuplicateGroups(
    "userQuestsCollection",
    { userId: "$userId", questTemplateId: "$questTemplateId", periodStart: "$periodStart", periodEnd: "$periodEnd" },
    pickUserQuestToKeep,
    { _id: "$_id", claimed: "$claimed", progress: "$progress" }
  );

  const duplicateFriendships = await removeDuplicateGroups(
    "friendshipsCollection",
    "$pairKey",
    pickFriendshipToKeep,
    { _id: "$_id", status: "$status", updatedAt: "$updatedAt", createdAt: "$createdAt" },
    [{ $addFields: { pairKey: PAIR_KEY_EXPRESSION } }]
  );

  const friendships = await getCollection("friendshipsCollection");
  await friendships.updateMany({ pairKey: { $exists: false } }, [{ $set: { pairKey: PAIR_KEY_EXPRESSION } }]);

  await dropNonUniqueIndex("userQuestsCollection", "idx_userQuests_sync_lookup");

  console.log(
    `Unique-index prep: removed ${duplicateUnlocks} duplicate unlocks, ${duplicateExercises} duplicate custom exercises, ` +
    `${duplicateQuestRows} duplicate quest rows, ${duplicateFriendships} duplicate friendships.`
  );
}
