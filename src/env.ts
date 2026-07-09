import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    server: {
        MONGODB_URI: z.url(),
        MONGODB_DB: z.string().min(1),
        MONGODB_WORKOUTS_COLLECTION: z.string().min(1).default("workouts"),
        MONGODB_RUNS_COLLECTION: z.string().min(1).default("runs"),
        MONGODB_QUEST_TEMPLATES_COLLECTION: z.string().min(1).default("quest_templates"),
        MONGODB_USER_QUESTS_COLLECTION: z.string().min(1).default("user_quests"),
        MONGODB_ACHIEVEMENTS_COLLECTION: z.string().min(1).default("achievements"),
        MONGODB_USER_ACHIEVEMENTS_COLLECTION: z.string().min(1).default("user_achievements"),
        MONGODB_CUSTOM_EXERCISES_COLLECTION: z.string().min(1).default("customExercises"),
    },
    client: {
        NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url(),
    },
    // For Next.js >= 13.4.4, you must explicitly pass client variables here
    experimental__runtimeEnv: {
        NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    },
});
