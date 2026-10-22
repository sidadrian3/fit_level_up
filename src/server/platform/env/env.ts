import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    server: {
        MONGODB_URI: z.string().startsWith("mongodb"),
        MONGODB_DB: z.string().min(1),

        UPSTASH_REDIS_REST_URL: z.string().url(),
        UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
        BETTER_AUTH_SECRET: z.string().min(10),
        CRON_SECRET: z.string().min(16),
    },
    experimental__runtimeEnv: {},
});
