import "server-only";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "@/server/platform/database";
import { env } from "@/server/platform/env";
import { UnauthorizedError } from "@/server/platform/http";
import { timeZoneSchema } from "@/shared/contracts/user";

const db = client.db(env.MONGODB_DB);

export const auth = betterAuth({
    database: mongodbAdapter(db, {
        client, // Passing the client enables database transactions
    }),
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            timeZone: {
                type: "string",
                required: false,
                input: true,
                validator: { input: timeZoneSchema },
            },
        },
    },
});

export async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id ?? null;
  } catch (error) {
    console.error("Failed to get session in getSessionUserId:", error);
    return null;
  }
}

export async function requireSessionUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new UnauthorizedError("Unauthorized");
  return userId;
}
