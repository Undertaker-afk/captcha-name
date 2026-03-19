import { createClient } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url:
    process.env.DB_URL ||
    "https://embarrassing-undertaker-afk.aws-eu-west-1.turso.io",
  authToken: process.env.DB_TOKEN,
});

export const db = drizzle(client, { schema });
