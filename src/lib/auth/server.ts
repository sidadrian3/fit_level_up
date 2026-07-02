import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "@/lib/mongodb";
import { env } from "../../env";

const db = client.db(env.MONGODB_DB);

export const auth = betterAuth({
    database: mongodbAdapter(db, {
        client, // Passing the client enables database transactions
    }),
    emailAndPassword: {
        enabled: true,
    },
});
