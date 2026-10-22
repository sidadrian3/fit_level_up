import { claimQuestReward } from "@/lib/services/quests/claim-quest-reward";
import { idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const POST = defineRoute(
  { name: "quests.claim", auth: "user", throttle: null, body: null, params: idParams },
  async ({ userId, params }) => {
    await claimQuestReward(userId, params.id);
    return { success: true };
  }
);
