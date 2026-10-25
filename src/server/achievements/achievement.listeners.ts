import { defineListener, type AnyListener } from "@/server/platform/events";
import { evaluateAchievements } from "./achievement.service";

export const achievementListeners: AnyListener[] = [
  defineListener({
    name: "achievements.evaluate",
    event: "activity.logged",
    handle: async ({ userId }) => {
      await evaluateAchievements(userId);
    },
  }),
  defineListener({
    name: "achievements.evaluate",
    event: "progression.leveled-up",
    handle: async ({ userId }) => {
      await evaluateAchievements(userId);
    },
  }),
];
