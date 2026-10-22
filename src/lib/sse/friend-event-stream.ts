import { consumeNextEvent } from "./sse-publisher";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function streamFriendEvents(userId: string): Response {
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
}
