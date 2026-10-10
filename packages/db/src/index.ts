import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const globalForDb = globalThis as unknown as { __w3sSql?: postgres.Sql };
const sql = globalForDb.__w3sSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__w3sSql = sql;

export const db = drizzle(sql, { schema, casing: "snake_case" });
export type Db = typeof db;
export { schema, sql };
