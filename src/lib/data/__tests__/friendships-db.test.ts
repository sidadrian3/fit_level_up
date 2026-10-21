import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { 
    insertFriendshipInDb, 
    getFriendshipByIdFromDb, 
    getFriendshipBetweenFromDb, 
    updateFriendshipStatusInDb, 
    deleteFriendshipInDb, 
    getAcceptedFriendIdsFromDb, 
    getPendingIncomingRequestsFromDb, 
    getAcceptedFriendshipsFromDb 
} from '../friendships-db';
import { getCollection } from '../get-collection';
import { ensureIndexes } from '../ensure-indexes';

describe('friendships-db Data Layer Test', () => {
    const userA = "user-A";
    const userB = "user-B";
    const userC = "user-C";

    beforeAll(async () => {
        await ensureIndexes();
        const col = await getCollection("friendshipsCollection");
        await col.deleteMany({});
    });

    afterAll(async () => {
        const col = await getCollection("friendshipsCollection");
        await col.deleteMany({});
    });

    it('should insert and return a Friendship with a valid id', async () => {
        const doc = await insertFriendshipInDb({
            requesterId: userA,
            receiverId: userB,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        expect(doc.id).toBeDefined();
        expect(doc.requesterId).toBe(userA);
        expect(doc.receiverId).toBe(userB);
        expect(doc.status).toBe("pending");
    });

    it('should throw code 11000 on duplicate (requesterId, receiverId)', async () => {
        await expect(insertFriendshipInDb({
            requesterId: userA,
            receiverId: userB,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        })).rejects.toThrowError(/11000/);
    });

    it('should throw code 11000 on the reverse pair (B->A) - one document per unordered pair', async () => {
        await expect(insertFriendshipInDb({
            requesterId: userB,
            receiverId: userA,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        })).rejects.toThrowError(/11000/);
    });

    it('getFriendshipBetween should find in both directions (A->B and B->A lookup)', async () => {
        const doc = await getFriendshipBetweenFromDb(userA, userB);
        expect(doc).toBeDefined();
        expect(doc?.requesterId).toBe(userA);
        expect(doc?.receiverId).toBe(userB);
        const reverse = await getFriendshipBetweenFromDb(userB, userA);
        expect(reverse?.id).toBe(doc?.id);
    });

    it('getFriendshipBetween should return null when no friendship exists', async () => {
        const doc = await getFriendshipBetweenFromDb(userA, userC);
        expect(doc).toBeNull();
    });

    it('getFriendshipById should return correct Friendship by id', async () => {
        const doc = await getFriendshipBetweenFromDb(userA, userB);
        const byId = await getFriendshipByIdFromDb(doc!.id);
        expect(byId?.id).toBe(doc?.id);
    });

    it('getFriendshipById should return null for unknown or malformed ID', async () => {
        const doc = await getFriendshipByIdFromDb("invalid-id");
        expect(doc).toBeNull();
        const doc2 = await getFriendshipByIdFromDb("507f1f77bcf86cd799439011");
        expect(doc2).toBeNull();
    });

    it('updateFriendshipStatus should transition pending -> accepted', async () => {
        const pending = await getFriendshipBetweenFromDb(userA, userB);
        const accepted = await updateFriendshipStatusInDb(pending!.id, "accepted", new Date());
        expect(accepted?.status).toBe("accepted");
    });

    it('updateFriendshipStatus should return null for unknown ID', async () => {
        const doc = await updateFriendshipStatusInDb("507f1f77bcf86cd799439011", "accepted", new Date());
        expect(doc).toBeNull();
    });

    it('getAcceptedFriendIds should return IDs from both directions and exclude pending/declined', async () => {
        const aFriends = await getAcceptedFriendIdsFromDb(userA);
        expect(aFriends).toContain(userB);
        expect(aFriends.length).toBe(1);

        const bFriends = await getAcceptedFriendIdsFromDb(userB);
        expect(bFriends).toContain(userA);
        expect(bFriends.length).toBe(1);

        const cFriends = await getAcceptedFriendIdsFromDb(userC);
        expect(cFriends.length).toBe(0);
    });

    it('getPendingIncomingRequests should return only incoming and pending', async () => {
        const pending = await insertFriendshipInDb({
            requesterId: "user-D",
            receiverId: userB,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const bRequests = await getPendingIncomingRequestsFromDb(userB);
        expect(bRequests.map(r => r.requesterId)).toEqual(["user-D"]);

        const dRequests = await getPendingIncomingRequestsFromDb("user-D");
        expect(dRequests.length).toBe(0);

        await deleteFriendshipInDb(pending.id, userB);
    });

    it('deleteFriendship should allow Requester to delete', async () => {
        const doc = await insertFriendshipInDb({
            requesterId: userA,
            receiverId: userC,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const success = await deleteFriendshipInDb(doc.id, userA);
        expect(success).toBe(true);
    });

    it('deleteFriendship should allow Receiver to delete', async () => {
        const doc = await insertFriendshipInDb({
            requesterId: userC,
            receiverId: userB,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const success = await deleteFriendshipInDb(doc.id, userB);
        expect(success).toBe(true);
    });

    it('deleteFriendship should return false for unknown ID', async () => {
        const success = await deleteFriendshipInDb("507f1f77bcf86cd799439011", userA);
        expect(success).toBe(false);
    });

    it('deleteFriendship should return false when userId is neither party', async () => {
        const doc = await getFriendshipBetweenFromDb(userA, userB);
        const success = await deleteFriendshipInDb(doc!.id, userC);
        expect(success).toBe(false);
    });
});
