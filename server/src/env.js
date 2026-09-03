// Loads server/.env (if present) into process.env, using Node's built-in
// loader (no dotenv dependency needed — Node 20.6+ ships this natively).
// Safe to import even if no .env file exists.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn(`Could not load .env: ${err.message}`);
  }
}
