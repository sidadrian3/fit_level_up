import type { SSEEvent } from "./sse-types";

class SSERegistry {
  // We store a mapping of userId to their open connection stream controller
  private connections = new Map<string, ReadableStreamDefaultController>();

  register(userId: string, controller: ReadableStreamDefaultController) {
    // If a user re-connects (e.g. opens a new tab or connection drops),
    // we replace the old controller with the new one.
    this.connections.set(userId, controller);
    console.log(`[SSE] User ${userId} registered.`);
  }

  unregister(userId: string) {
    this.connections.delete(userId);
    console.log(`[SSE] User ${userId} unregistered.`);
  }

  notify(userId: string, event: SSEEvent) {
    const controller = this.connections.get(userId);
    if (!controller) {
      // User is not connected right now (e.g. app closed). This is perfectly fine.
      return;
    }

    // Format the SSE payload
    // SSE requires `data: {string}\n\n`
    const dataString = `data: ${JSON.stringify(event)}\n\n`;

    try {
      controller.enqueue(new TextEncoder().encode(dataString));
    } catch (error) {
      // If the pipe is broken (e.g. client disconnected ungracefully)
      console.warn(`[SSE] Failed to send event to user ${userId}, cleaning up connection.`, error);
      this.unregister(userId);
    }
  }

  notifyMany(userIds: string[], event: SSEEvent) {
    for (const userId of userIds) {
      this.notify(userId, event);
    }
  }
}

// Export a singleton instance to be used across the app
export const sseRegistry = new SSERegistry();
