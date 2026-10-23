import { streamFriendEvents } from "@/lib/sse/friend-event-stream";
import { defineRoute } from "@/server/runtime";

// On Vercel Pro, increase this to 300 for longer-lived SSE connections.
// On Hobby plan the max is 60 seconds — the client will auto-reconnect after that.
export const maxDuration = 60;

export const GET = defineRoute({ name: "friends.events", auth: "user" }, async ({ userId }) => streamFriendEvents(userId));
