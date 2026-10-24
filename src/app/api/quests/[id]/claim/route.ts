import { claimQuest } from "@/server/quests";
import { idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const POST = defineRoute(
  { name: "quests.claim", auth: "user", throttle: "standard", body: null, params: idParams },
  async ({ userId, params }) => {
    await claimQuest(userId, params.id);
    return { success: true };
  }
);
