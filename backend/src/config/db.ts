import { MongoClient, Db } from "mongodb";
import { config } from "./index";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  const uri = config.mongoUri;
  if (!uri) {
    throw new Error("MONGO_URI is not set in environment variables");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(config.dbName);

  console.log(`✓ Connected to MongoDB: ${config.dbName}`);
  return db;
}

export async function getDB(): Promise<Db> {
  if (!db) return connectDB();
  return db;
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
