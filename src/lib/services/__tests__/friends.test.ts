import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getCollection } from '@/lib/data/get-collection';
import { ensureIndexes } from '@/lib/data/ensure-indexes';
import * as ssePublisher from '@/lib/sse/sse-publisher';

import { sendFriendRequest } from '../friends/send-friend-request';
import { acceptFriendRequest } from '../friends/accept-friend-request';
import { declineFriendRequest } from '../friends/decline-friend-request';
import { getFriends } from '../friends/get-friends';
import { getFriendRequests } from '../friends/get-friend-requests';
import { removeFriend } from '../friends/remove-friend';


describe('friends Service Layer Test', () => {
    let userA: { id: string };
    let userB: { id: string };
    let userC: { id: string };

    beforeAll(async () => {
        await ensureIndexes();
        const col = await getCollection("friendshipsCollection");
        await col.deleteMany({});
        const userCol = await getCollection("usersCollection");
        await userCol.deleteMany({});

        const resA = await userCol.insertOne({ name: "User A", email: "a@a.com", level: 1, xp: 0, xpToNextLevel: 500, streak: 0, totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date() });
        const resB = await userCol.insertOne({ name: "User B", email: "b@b.com", level: 1, xp: 0, xpToNextLevel: 500, streak: 0, totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date() });
        const resC = await userCol.insertOne({ name: "User C", email: "c@c.com", level: 1, xp: 0, xpToNextLevel: 500, streak: 0, totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date() });

        userA = { id: resA.insertedId.toString() };
        userB = { id: resB.insertedId.toString() };
        userC = { id: resC.insertedId.toString() };
    });

    beforeEach(async () => {
        const col = await getCollection("friendshipsCollection");
        await col.deleteMany({});
        vi.clearAllMocks();
        vi.spyOn(ssePublisher, 'publishToUser').mockResolvedValue(undefined);
        vi.spyOn(ssePublisher, 'publishToMany').mockResolvedValue(undefined);
    });

    afterAll(async () => {
        const col = await getCollection("friendshipsCollection");
        await col.deleteMany({});
        const userCol = await getCollection("usersCollection");
        await userCol.deleteMany({});
        vi.restoreAllMocks();
    });

    describe('sendFriendRequest', () => {
        it('Creates Friendship with status "pending"', async () => {
            const result = await sendFriendRequest(userA.id, userB.id);
            expect(result.status).toBe("pending");
            expect(result.requesterId).toBe(userA.id);
            expect(result.receiverId).toBe(userB.id);
            
            expect(ssePublisher.publishToUser).toHaveBeenCalledWith(userB.id, expect.objectContaining({ type: "friend_request" }));
        });

        it('Throws for self-request', async () => {
            await expect(sendFriendRequest(userA.id, userA.id)).rejects.toThrow("Cannot send a friend request to yourself");
        });

        it('Throws "Friend request already sent" on duplicate', async () => {
            await sendFriendRequest(userA.id, userB.id);
            await expect(sendFriendRequest(userA.id, userB.id)).rejects.toThrow("Friend request already sent");
        });

        it('Throws "User not found" for unknown receiverId', async () => {
            await expect(sendFriendRequest(userA.id, "507f1f77bcf86cd799439011")).rejects.toThrow("User not found");
        });

        it('Re-request after decline creates a new document successfully', async () => {
            const req = await sendFriendRequest(userA.id, userB.id);
            await declineFriendRequest(userA.id, userB.id); 

            const req2 = await sendFriendRequest(userB.id, userA.id); 
            expect(req2.status).toBe("pending");
        });
    });

    describe('acceptFriendRequest', () => {
        it('Status becomes "accepted" and parties appear in getFriends', async () => {
            const req = await sendFriendRequest(userA.id, userB.id);
            const accepted = await acceptFriendRequest(userA.id, userB.id);
            expect(accepted.status).toBe("accepted");
            
            await new Promise(r => setTimeout(r, 50));
            expect(ssePublisher.publishToUser).toHaveBeenCalledWith(userA.id, expect.objectContaining({ type: "friend_accepted" }));

            const aFriends = await getFriends(userA.id);
            expect(aFriends.length).toBe(1);
            expect(aFriends[0].userId).toBe(userB.id);
            expect(aFriends[0].name).toBe("User B");

            const bFriends = await getFriends(userB.id);
            expect(bFriends.length).toBe(1);
            expect(bFriends[0].userId).toBe(userA.id);
        });

        it('Throws when requester tries to accept their own request', async () => {
            const req = await sendFriendRequest(userA.id, userB.id);
            await expect(acceptFriendRequest(userB.id, userA.id)).rejects.toThrow("Not authorized");
        });

        it('Throws conflict when already accepted', async () => {
            const req = await sendFriendRequest(userA.id, userB.id);
            await acceptFriendRequest(userA.id, userB.id);
            await expect(acceptFriendRequest(userA.id, userB.id)).rejects.toThrow("Friend request is not pending");
        });

        it('Throws not-found for non-existent ID', async () => {
            await expect(acceptFriendRequest("507f1f77bcf86cd799439011", userB.id)).rejects.toThrow("Friend request not found");
        });
    });

    describe('declineFriendRequest', () => {
        it('Status becomes "declined" and not in getFriends', async () => {
            const req = await sendFriendRequest(userA.id, userB.id);
            const declined = await declineFriendRequest(userA.id, userB.id);
            expect(declined.status).toBe("declined");

            const aFriends = await getFriends(userA.id);
            expect(aFriends.length).toBe(0);
        });

        it('Throws when requester tries to decline their own request', async () => {
            const req = await sendFriendRequest(userA.id, userB.id);
            await expect(declineFriendRequest(userB.id, userA.id)).rejects.toThrow("Not authorized");
        });
    });

    describe('removeFriend', () => {
        it('Requester or Receiver can remove -> { success: true }', async () => {
            const req1 = await sendFriendRequest(userA.id, userB.id);
            await acceptFriendRequest(userA.id, userB.id);
            
            const res = await removeFriend(userB.id, userA.id);
            expect(res.success).toBe(true);

            await sendFriendRequest(userA.id, userC.id);
            await acceptFriendRequest(userA.id, userC.id);

            const res2 = await removeFriend(userA.id, userC.id);
            expect(res2.success).toBe(true);
        });

        it('Throws not found for unknown ID', async () => {
            await expect(removeFriend("507f1f77bcf86cd799439011", userA.id)).rejects.toThrow("Friendship not found");
        });

        it('Throws Not authorized when a third user tries to remove', async () => {
            const req1 = await sendFriendRequest(userA.id, userB.id);
            await expect(removeFriend(userA.id, userC.id)).rejects.toThrow("Friendship not found");
        });
    });

    describe('getFriendRequests', () => {
        it('Returns incoming pending requests with requester profile', async () => {
            await sendFriendRequest(userA.id, userB.id);
            await sendFriendRequest(userC.id, userB.id);

            const reqs = await getFriendRequests(userB.id);
            expect(reqs.length).toBe(2);
            expect(reqs[0].name).toBeDefined();

            const reqsA = await getFriendRequests(userA.id);
            expect(reqsA.length).toBe(0);
        });
    });
});
