import { DomainError } from "./domain-error";

export function validateFriendRequest(requesterId: string, receiverId: string): void {
    if(!requesterId || !receiverId){
        throw new DomainError("invalid", "Requester and receiver IDs are required");
    }

    if( requesterId === receiverId){
        throw new DomainError("invalid", "Cannot send a friend request to yourself");
    }
}

export function buildFriendshipPairKey(userIdA: string, userIdB: string): string {
    return [userIdA, userIdB].sort().join(":");
}
