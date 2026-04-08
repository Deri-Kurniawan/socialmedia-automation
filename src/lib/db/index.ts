import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// Initialize SQLite database
const sqlite = new Database("./sqlite.db");

// Create Drizzle ORM instance
export const db = drizzle({ client: sqlite, schema });

export type Database = typeof db;
