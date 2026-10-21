import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { env } from "../../env";
import type { auth } from "./server";

export const authClient = createAuthClient({
    baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
    plugins: [inferAdditionalFields<typeof auth>()],
});
