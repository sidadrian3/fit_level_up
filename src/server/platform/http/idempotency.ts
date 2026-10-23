import { isDuplicateKeyError } from "@/server/platform/database";
import { IdempotencyKeyReusedError } from "./errors";

export interface IdempotencyRequest {
  key: string;
  fingerprint: string;
}

export interface IdempotentResult<T> {
  value: T;
  replayed: boolean;
}

export interface IdempotentRecord<T> {
  value: T;
  fingerprint: string | undefined;
}

interface CreateOnceOptions<T> {
  request: IdempotencyRequest;
  findExisting: () => Promise<IdempotentRecord<T> | null>;
  create: () => Promise<T>;
  reusedMessage: string;
}

export async function createOnce<T>({
  request,
  findExisting,
  create,
  reusedMessage,
}: CreateOnceOptions<T>): Promise<IdempotentResult<T>> {
  async function replayExisting(): Promise<IdempotentResult<T> | null> {
    const existing = await findExisting();
    if (!existing) return null;
    if (existing.fingerprint !== request.fingerprint) {
      throw new IdempotencyKeyReusedError(reusedMessage);
    }
    return { value: existing.value, replayed: true };
  }

  const replay = await replayExisting();
  if (replay) return replay;

  try {
    return { value: await create(), replayed: false };
  } catch (err) {
    if (!isDuplicateKeyError(err, "idempotencyKey")) throw err;
    // A concurrent request with the same key won the unique index.
    const winner = await replayExisting();
    if (!winner) throw err;
    return winner;
  }
}
