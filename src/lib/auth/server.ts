import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "@/server/platform/database";
import { env } from "@/server/platform/env";
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
