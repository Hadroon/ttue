import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Get database URL from environment variable
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ttue_dev";

// Create PostgreSQL connection
const queryClient = postgres(databaseUrl);

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Test database connection
export async function testConnection() {
  try {
    await queryClient`SELECT 1`;
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

// Export schema for use in other files
export { schema };
