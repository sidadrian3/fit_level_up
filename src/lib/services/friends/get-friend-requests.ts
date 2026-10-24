import type { FriendProfile } from "@/lib/types";
import { getPendingIncomingRequestsFromDb } from "@/lib/data/friendships-db";
import { getUser } from "@/lib/services/users/get-user";

export async function getFriendRequests(userId: string): Promise<FriendProfile[]> {
    const requests = await getPendingIncomingRequestsFromDb(userId);
    const profiles: FriendProfile[] = [];

    for (const friendship of requests) {
        // For incoming requests, the other person is always the requester
        const requesterId = friendship.requesterId;
        
        // We only fetch basic user info.
        // We don't need their full workouts/runs to show a pending request card.
        const user = await getUser(requesterId);
        if (!user) continue;

        profiles.push({
            userId: user.id,
            name: user.name,
            avatar: user.avatar,
            level: user.level,
            streak: user.streak,
            totalWorkouts: user.totalWorkouts,
            totalDistance: user.totalDistance,
            personalRecords: [], // Not calculated for requests to save DB load
            friendship
        });
    }

    // Sort newest requests first
    return profiles.sort((a, b) => new Date(b.friendship.createdAt).getTime() - new Date(a.friendship.createdAt).getTime());
}
