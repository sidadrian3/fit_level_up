import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { sseRegistry } from '../sse-registry';

type MockController = { enqueue: Mock; close: Mock };
import { SSEEvent } from '../sse-types';

describe('sse-registry Unit Test', () => {
    let mockController: MockController;
    const userId = "test-user-id";

    beforeEach(() => {
        sseRegistry.unregister(userId);
        sseRegistry.unregister("user-2");
        
        mockController = {
            enqueue: vi.fn(),
            close: vi.fn()
        };
    });

    it('register() / unregister() should work correctly', () => {
        sseRegistry.register(userId, mockController as unknown as ReadableStreamDefaultController);
        
        const event: SSEEvent = { type: "ping", payload: { actorId: "", actorName: "", timestamp: "" } };
        sseRegistry.notify(userId, event);
        expect(mockController.enqueue).toHaveBeenCalledTimes(1);

        sseRegistry.unregister(userId);
        sseRegistry.notify(userId, event);
        expect(mockController.enqueue).toHaveBeenCalledTimes(1); 
    });

    it('Re-registering same userId replaces stale controller', () => {
        const mockController2: MockController = { enqueue: vi.fn(), close: vi.fn() };
        sseRegistry.register(userId, mockController as unknown as ReadableStreamDefaultController);
        sseRegistry.register(userId, mockController2 as unknown as ReadableStreamDefaultController);

        const event: SSEEvent = { type: "ping", payload: { actorId: "", actorName: "", timestamp: "" } };
        sseRegistry.notify(userId, event);
        expect(mockController.enqueue).not.toHaveBeenCalled();
        expect(mockController2.enqueue).toHaveBeenCalledTimes(1);
    });

    it('notify() calls controller.enqueue() with correct "data: ...\n\n" SSE format', () => {
        sseRegistry.register(userId, mockController as unknown as ReadableStreamDefaultController);
        const event: SSEEvent = { type: "friend_request", payload: { actorId: "A", actorName: "B", timestamp: "now" } };
        sseRegistry.notify(userId, event);

        const expectedString = `data: ${JSON.stringify(event)}\n\n`;
        const expectedBytes = new TextEncoder().encode(expectedString);
        expect(mockController.enqueue).toHaveBeenCalledWith(expectedBytes);
    });

    it('notify() handles broken pipe (catches throw and unregisters)', () => {
        mockController.enqueue.mockImplementation(() => { throw new Error("Broken pipe"); });
        sseRegistry.register(userId, mockController as unknown as ReadableStreamDefaultController);
        
        const event: SSEEvent = { type: "ping", payload: { actorId: "", actorName: "", timestamp: "" } };
        expect(() => {
            sseRegistry.notify(userId, event);
        }).not.toThrow();
    });

    it('notifyMany() calls notify for each userId', () => {
        const mock2: MockController = { enqueue: vi.fn(), close: vi.fn() };
        sseRegistry.register(userId, mockController as unknown as ReadableStreamDefaultController);
        sseRegistry.register("user-2", mock2 as unknown as ReadableStreamDefaultController);

        const event: SSEEvent = { type: "ping", payload: { actorId: "", actorName: "", timestamp: "" } };
        sseRegistry.notifyMany([userId, "user-2", "user-3"], event);

        expect(mockController.enqueue).toHaveBeenCalledTimes(1);
        expect(mock2.enqueue).toHaveBeenCalledTimes(1);
    });
});
