import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { consumeNextEvent } from "@/lib/sse/sse-publisher";

// On Vercel Pro, increase this to 300 for longer-lived SSE connections.
// On Hobby plan the max is 60 seconds — the client will auto-reconnect after that.
export const maxDuration = 60;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
    try {
        const userId = await getAuthUserId();

        const encoder = new TextEncoder();
        let running = true;

        const stream = new ReadableStream({
            start(controller) {
                const poll = async () => {
                    while (running) {
                        try {
                            const event = await consumeNextEvent(userId);

                            if (event) {
                                // Real event from Redis queue — forward to browser
                                const data = `data: ${JSON.stringify(event)}\n\n`;
                                controller.enqueue(encoder.encode(data));
                            } else {
                                // No event pending — send heartbeat ping to keep connection alive
                                const ping = `data: ${JSON.stringify({
                                    type: "ping",
                                    payload: { actorId: "", actorName: "", timestamp: new Date().toISOString() }
                                })}\n\n`;
                                controller.enqueue(encoder.encode(ping));
                            }
                        } catch {
                            // Stream may have been closed by the client
                            running = false;
                            break;
                        }

                        await sleep(5000); // Poll every 5 seconds
                    }
                };

                poll().catch(() => {
                    running = false;
                });
            },
            cancel() {
                running = false;
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
