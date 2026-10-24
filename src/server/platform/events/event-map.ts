// Each module adds its events with `declare module "@/server/platform/events"`.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EventMap {}

export type EventType = keyof EventMap;
