import "server-only";

export {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  listFriends,
  listFriendRequests,
  getAcceptedFriendIds,
  getFriendRecords,
} from "./friendship.service";
export { buildFriendshipPairKey } from "./friendship.rules";
