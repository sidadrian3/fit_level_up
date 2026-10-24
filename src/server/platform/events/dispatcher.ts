import type { ObjectId } from "mongodb";
import { getCollection, type OutboxDoc } from "@/server/platform/database";
import { OUTBOX_TUNING } from "@/server/platform/config";
import type { EventMap, EventType } from "./event-map";
import type { AnyListener } from "./listener";

type OutboxRow = OutboxDoc<EventType, EventMap[EventType]>;
type Outcome = "delivered" | "failed" | "dead";
type Summary = Record<Outcome, number>;

const { leaseMs, maxAttempts, backoffBaseMs, backoffCapMs, overduePerRequest, cronBudgetMs } = OUTBOX_TUNING;

function backoffMs(attempts: number): number {
    return Math.min(backoffBaseMs * 2 ** (attempts - 1), backoffCapMs);
}

function describeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export function createDispatcher(listeners: readonly AnyListener[], options: { now?: () => Date } = {}) {
    const now = options.now ?? (() => new Date());

    const seen = new Set<string>();
    for (const { event, name } of listeners) {
        const key = `${event}/${name}`;
        if (seen.has(key)) throw new Error(`Duplicate listener ${key}`);
        seen.add(key);
    }

    async function claim(selector: { _id?: ObjectId }): Promise<OutboxRow | null> {
        const outbox = await getCollection<OutboxRow>("outbox");
        const at = now();
        return outbox.findOneAndUpdate(
            { ...selector, status: "pending", availableAt: { $lte: at } },
            {
                $set: { availableAt: new Date(at.getTime() + leaseMs) },
                $inc: { attempts: 1 },
            },
            { sort: { availableAt: 1 }, returnDocument: "after" },
        );
    }

    async function deliver(row: OutboxRow): Promise<Outcome> {
        const outbox = await getCollection<OutboxRow>("outbox");
        const failures: string[] = [];

        for (const listener of listeners) {
            if (listener.event !== row.type || row.completedListeners.includes(listener.name)) continue;
            try {
                // Promise.resolve().then also catches a handler that throws before returning a promise
                await Promise.resolve().then(() =>
                    listener.handle(row.payload, {
                        eventId: row._id!,
                        createdAt: row.createdAt,
                    }),
                );
                await outbox.updateOne({ _id: row._id }, { $addToSet: { completedListeners: listener.name } });
            } catch (err) {
                failures.push(`${listener.name}: ${describeError(err)}`);
            }
        }

        const at = now();
        if (failures.length === 0) {
            await outbox.updateOne({ _id: row._id }, { $set: { status: "done", processedAt: at } });
            return "delivered";
        }

        const lastError = failures.join("; ");
        if (row.attempts >= maxAttempts) {
            await outbox.updateOne({ _id: row._id }, { $set: { status: "dead", processedAt: at, lastError } });
            console.error(`[Outbox] ${row.type} ${row._id} is dead after ${row.attempts} attempts: ${lastError}`);
            return "dead";
        }

        const availableAt = new Date(at.getTime() + backoffMs(row.attempts));
        await outbox.updateOne({ _id: row._id }, { $set: { availableAt, lastError } });
        return "failed";
    }

    async function claimAndDeliver(selector: { _id?: ObjectId }): Promise<Outcome | null> {
        const row = await claim(selector);
        return row && deliver(row);
    }

    async function dispatchOwnAndOverdue(ids: ObjectId[]): Promise<void> {
        try {
            for (const _id of ids) await claimAndDeliver({ _id });
            for (let i = 0; i < overduePerRequest; i++) {
                if (!(await claimAndDeliver({}))) break;
            }
        } catch (err) {
            console.error("[Outbox] dispatch failed", err);
        }
    }

    async function drainUntilEmpty({ budgetMs = cronBudgetMs }: { budgetMs?: number } = {}): Promise<Summary> {
        const summary: Summary = { delivered: 0, failed: 0, dead: 0 };
        const deadline = Date.now() + budgetMs;
        while (Date.now() < deadline) {
            const outcome = await claimAndDeliver({});
            if (!outcome) break;
            summary[outcome] += 1;
        }
        return summary;
    }

    return { dispatchOwnAndOverdue, drainUntilEmpty };
}
