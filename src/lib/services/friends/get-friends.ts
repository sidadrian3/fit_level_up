import type { FriendProfile } from "@/lib/types";
import { getAcceptedFriendshipsFromDb } from "@/lib/data/friendships-db";
import { getUserFromDb } from "@/lib/data/user-db";
import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { calculatePersonalRecords } from "@/lib/utils/records";

export async function getFriends(userId: string): Promise<FriendProfile[]> {
    const friendships = await getAcceptedFriendshipsFromDb(userId);
    const profiles: FriendProfile[] = [];

    for (const friendship of friendships) {
        // Determine the ID of the friend (the other person in the relationship)
        const friendId = friendship.requesterId === userId ? friendship.receiverId : friendship.requesterId;
        
        // Parallel fetch for speed
        const [user, workouts, runs] = await Promise.all([
            getUserFromDb(friendId),
            getAllWorkoutsFromDb(friendId),
            getAllRunsFromDb(friendId)
        ]);

        if (!user) continue;

        // Calculate their personal records on the fly
        const personalRecords = calculatePersonalRecords(workouts, runs);

        profiles.push({
            userId: user.id,
            name: user.name,
            avatar: user.avatar,
            level: user.level,
            streak: user.streak,
            totalWorkouts: user.totalWorkouts,
            totalDistance: user.totalDistance,
            personalRecords,
            friendship
        });
    }

    // Sort by level descending as a nice default
    return profiles.sort((a, b) => b.level - a.level);
}
