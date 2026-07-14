export function validateFriendRequest(requesterId: string, receiverId: string): void {
    if(!requesterId || !receiverId){
        throw new Error("Requester and receiver IDs are required");
    }

    if( requesterId === receiverId){
        throw new Error("Cannot send a friend request to yourself");
    }
}