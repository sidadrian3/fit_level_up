import { MongoClient, ServerApiVersion } from "mongodb";
import { ensureIndexes } from "./data/ensure-indexes";
const uri = process.env.MONGODB_URI;

if (!uri) {
    throw new Error("Missing MONGODB_URI in .env.local");
}

const options = {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
    // eslint-disable-next-line no-var
    var _mongoClientPromise: Promise<MongoClient> | undefined;
    // eslint-disable-next-line no-var
    var _mongoClient: MongoClient | undefined;
}

if (process.env.NODE_ENV === "development") {
    // In dev, use a global var so hot-reload doesn't create extra clients.
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClient = client;
        global._mongoClientPromise = client.connect();
    }
    client = global._mongoClient!;
    clientPromise = global._mongoClientPromise;
} else {
    // In prod, make a fresh client for this process.
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

export { client };
export default clientPromise;

clientPromise.then(() =>
    ensureIndexes()).catch(console.error);