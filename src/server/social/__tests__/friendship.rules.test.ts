import { describe, it, expect } from "vitest";
import { DomainError } from "@/server/platform/domain";
import { checkFriendshipTransition, validateFriendRequest } from "../friendship.rules";

const DAY = 86_400_000;
const pending = { requesterId: "a", receiverId: "b", status: "pending" as const, updatedAt: new Date(0) };
const accepted = { ...pending, status: "accepted" as const };
const declined = { ...pending, status: "declined" as const };

describe("checkFriendshipTransition", () => {
  it.each([
    ["accept by receiver", "accept", pending, "b", "ok"],
    ["accept by requester", "accept", pending, "a", "notAllowed"],
    ["accept when accepted", "accept", accepted, "b", "wrongState"],
    ["accept when declined", "accept", declined, "b", "wrongState"],
    ["decline by receiver", "decline", pending, "b", "ok"],
    ["decline by requester", "decline", pending, "a", "notAllowed"],
    ["decline when accepted", "decline", accepted, "b", "wrongState"],
    ["remove pending by requester", "remove", pending, "a", "ok"],
    ["remove pending by receiver", "remove", pending, "b", "ok"],
    ["remove accepted by either", "remove", accepted, "b", "ok"],
    ["remove accepted by stranger", "remove", accepted, "c", "notAllowed"],
    ["remove declined", "remove", declined, "a", "wrongState"],
    ["reopen when pending", "reopen", pending, "a", "wrongState"],
  ] as const)("%s", (_name, action, friendship, actor, verdict) => {
    expect(checkFriendshipTransition(action, friendship, actor, new Date(1), 7)).toBe(verdict);
  });

  it("reopen by the declined requester inside the cooldown is coolingDown", () =>
    expect(checkFriendshipTransition("reopen", declined, "a", new Date(7 * DAY - 1), 7)).toBe("coolingDown"));

  it("reopen by the declined requester at exactly 7 days is ok", () =>
    expect(checkFriendshipTransition("reopen", declined, "a", new Date(7 * DAY), 7)).toBe("ok"));

  it("reopen by the decliner inside the cooldown is ok", () =>
    expect(checkFriendshipTransition("reopen", declined, "b", new Date(1), 7)).toBe("ok"));

  it("reopen by a stranger is notAllowed", () =>
    expect(checkFriendshipTransition("reopen", declined, "c", new Date(8 * DAY), 7)).toBe("notAllowed"));
});

describe("validateFriendRequest", () => {
  it("passes for two distinct ids", () => {
    expect(() => validateFriendRequest("user1", "user2")).not.toThrow();
  });

  it("throws an invalid DomainError for a self-request", () => {
    expect(() => validateFriendRequest("userA", "userA")).toThrow(DomainError);
    expect(() => validateFriendRequest("userA", "userA")).toThrow("Cannot send a friend request to yourself");
  });

  it.each([["", "userB"], ["userA", ""]])("throws for an empty id (%j, %j)", (requesterId, receiverId) => {
    expect(() => validateFriendRequest(requesterId, receiverId)).toThrow("Requester and receiver IDs are required");
  });
});
