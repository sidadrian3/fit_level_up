import { describe, it, expect } from "vitest";
import { validateFriendRequest } from "../friend-rules";

describe("validateFriendRequest", () => {
    it("Should pass silently for two distinct valid user IDs", () => {
        expect(() => validateFriendRequest("user1", "user2")).not.toThrow();
    });

    it("Should throw when requesterId === receiverId", () => {
        expect(() => validateFriendRequest("userA", "userA")).toThrow("Cannot send a friend request to yourself");
    });

    it("Should throw for empty requesterId", () => {
        expect(() => validateFriendRequest("", "userB")).toThrow("Requester and receiver IDs are required");
    });

    it("Should throw for empty receiverId", () => {
        expect(() => validateFriendRequest("userA", "")).toThrow("Requester and receiver IDs are required");
    });
});
