import type { ClientSession } from "mongodb";
import {
  userScopedRepository,
  type UserOwnedDoc,
  type XpLedgerDoc,
} from "@/server/platform/database";

export type XpSource = { type: XpLedgerDoc["sourceType"]; id: string };

type OwnedXpLedgerDoc = XpLedgerDoc & UserOwnedDoc;

const ledger = userScopedRepository<OwnedXpLedgerDoc>("xpLedger");

export async function recordXp(
  userId: string,
  {
    source,
    amount,
    occurredAt,
  }: { source: XpSource; amount: number; occurredAt: Date },
  session: ClientSession,
): Promise<void> {
  await ledger.insertOne(
    userId,
    {
      sourceType: source.type,
      sourceId: source.id,
      amount,
      occurredAt,
      createdAt: new Date(),
    },
    { session },
  );
}

export async function upsertXp(
  userId: string,
  {
    source,
    amount,
    occurredAt,
  }: { source: XpSource; amount: number; occurredAt: Date },
  session: ClientSession,
): Promise<void> {
  await ledger.updateOne(
    userId,
    { sourceType: source.type, sourceId: source.id },
    { $set: { amount }, $setOnInsert: { occurredAt, createdAt: new Date() } },
    { session, upsert: true },
  );
}

export async function deleteXp(
  userId: string,
  source: XpSource,
  session: ClientSession,
): Promise<void> {
  const row = await ledger.findOne(
    userId,
    { sourceType: source.type, sourceId: source.id },
    { session },
  );
  if (row) await ledger.deleteById(userId, row._id.toString(), { session });
}

export async function sumXp(
  userId: string,
  session: ClientSession,
): Promise<number> {
  const [result] = await ledger.aggregate<{ total: number }>(
    userId,
    [{ $group: { _id: null, total: { $sum: "$amount" } } }],
    { session },
  );
  return result?.total ?? 0;
}
