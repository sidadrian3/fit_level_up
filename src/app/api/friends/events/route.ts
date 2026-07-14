import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { sseRegistry } from "@/lib/sse/sse-registry";

export const runtime = "edge"; // Important for Vercel Hobby plan no timeout

export async function GET() {
    try {
        const userId = await getAuthUserId();

        const stream = new ReadableStream({
            start(controller) {
                sseRegistry.register(userId, controller);

                // Send a heartbeat ping every 20 seconds to keep connection alive
                const heartbeat = setInterval(() => {
                    sseRegistry.notify(userId, { 
                        type: "ping", 
                        payload: { actorId: "", actorName: "", timestamp: new Date().toISOString() } 
                    });
                }, 20_000);

                return () => {
                    clearInterval(heartbeat);
                    sseRegistry.unregister(userId);
                };
            },
            cancel() {
                sseRegistry.unregister(userId);
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (err) {
        return new Response("Unauthorized", { status: 401 });
    }
}
