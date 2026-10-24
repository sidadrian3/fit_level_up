import type { ObjectId } from "mongodb";
import type { EventMap, EventType } from "./event-map";

export interface Listener<K extends EventType> {
    name: string;
    event: K;
    handle(payload: EventMap[K], meta: { eventId: ObjectId; createdAt: Date }): Promise<void>;
}

export type AnyListener = Listener<EventType>;

export function defineListener<K extends EventType>(listener: Listener<K>): AnyListener {
    return listener as unknown as AnyListener;
}
