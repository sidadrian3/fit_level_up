export type SSEEvent = {
  type: "friend_request" | "friend_accepted" | "friend_level_up" | "ping";
  payload: {
    actorId: string;       // who triggered it
    actorName: string;     // display name for the toast
    actorAvatar?: string;  // for the toast avatar
    newLevel?: number;     // populated only for friend_level_up
    timestamp: string;     // ISO
  };
};
