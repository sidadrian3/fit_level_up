import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "@/lib/mongodb";

const db = client.db(process.env.MONGODB_DB);

export const auth = betterAuth({
    database: mongodbAdapter(db, {
        client, // Passing the client enables database transactions
    }),
    emailAndPassword: {
        enabled: true,
    },
});
