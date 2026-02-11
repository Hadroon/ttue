import postgres from "postgres";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ttue_dev";
const sql = postgres(databaseUrl);

async function runMigration() {
  try {
    console.log("Running migration 0006_add_draft_proposals.sql...");
    
    const migrationPath = join(__dirname, "migrations", "0006_add_draft_proposals.sql");
    const migrationSQL = readFileSync(migrationPath, "utf8");
    
    // Remove comments and split by semicolons to get individual statements
    const statements = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.includes('--> statement-breakpoint')) continue;
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await sql.unsafe(statement);
    }
    
    console.log("✅ Migration completed successfully");
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
