import { z } from "zod";

export const SendFriendRequestSchema = z.object({
  receiverId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID format"),
});
