import { z } from "zod";

export const SendFriendRequestSchema = z.object({
  receiverId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID format"),
});

export type FriendshipStatus = "pending" | "accepted" | "declined";

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendProfile {
  userId: string;
  name: string;
  avatar: string;
  level: number;
  streak: number;
  totalWorkouts: number;
  totalDistance: number;
  friendship: Friendship;
}
