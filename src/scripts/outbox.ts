import { clientPromise, getCollection, parseObjectId, type OutboxDoc } from "@/server/platform/database";

const DEAD_ROW_LIMIT = 50;
const USAGE = "Usage: npm run outbox -- --dead | --requeue <id>";

async function listDeadRows() {
  const outbox = await getCollection<OutboxDoc>("outbox");
  const rows = await outbox.find({ status: "dead" }).sort({ processedAt: -1 }).limit(DEAD_ROW_LIMIT).toArray();
  console.table(rows.map(({ _id, type, attempts, lastError, processedAt }) => ({ _id: String(_id), type, attempts, lastError, processedAt })));
}

async function requeueDeadRow(id: string) {
  const _id = parseObjectId(id);
  if (!_id) {
    console.log(`Invalid id ${id}`);
    return;
  }
  const outbox = await getCollection<OutboxDoc>("outbox");
  const { modifiedCount } = await outbox.updateOne(
    { _id, status: "dead" },
    { $set: { status: "pending", availableAt: new Date(), attempts: 0, processedAt: null } }
  );
  console.log(modifiedCount ? `Requeued ${id}` : `No dead row ${id}`);
}

async function main() {
  const [flag, id] = process.argv.slice(2);
  try {
    if (flag === "--dead") await listDeadRows();
    else if (flag === "--requeue" && id) await requeueDeadRow(id);
    else console.log(USAGE);
  } finally {
    await (await clientPromise).close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
