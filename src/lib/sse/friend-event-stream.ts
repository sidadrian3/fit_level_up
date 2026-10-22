import { consumeNextEvent } from "./sse-publisher";

const POLL_INTERVAL_MS = 5000;

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
                            const data = `data: ${JSON.stringify(event)}\n\n`;
                            controller.enqueue(encoder.encode(data));
                        } else {
                            const ping = `data: ${JSON.stringify({
                                type: "ping",
                                payload: { actorId: "", actorName: "", timestamp: new Date().toISOString() }
                            })}\n\n`;
                            controller.enqueue(encoder.encode(ping));
                        }
                    } catch {
                        // enqueue throws once the client has closed the stream
                        running = false;
                        break;
                    }

                    await sleep(POLL_INTERVAL_MS);
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
