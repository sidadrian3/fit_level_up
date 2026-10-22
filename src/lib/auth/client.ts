import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { clientEnv } from "@/lib/env";
import type { auth } from "@/server/platform/auth";

export const authClient = createAuthClient({
    baseURL: clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL,
    plugins: [inferAdditionalFields<typeof auth>()],
});
