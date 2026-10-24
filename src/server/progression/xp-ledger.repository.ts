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
