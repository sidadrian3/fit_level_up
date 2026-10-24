import { AsyncLocalStorage } from "node:async_hooks";
import type { ObjectId } from "mongodb";

const emittedIds = new AsyncLocalStorage<ObjectId[]>();

export function collectEmittedEvents<T>(ids: ObjectId[], fn: () => Promise<T>): Promise<T> {
    return emittedIds.run(ids, fn);
}

export function recordEmitted(id: ObjectId): void {
    emittedIds.getStore()?.push(id);
}
