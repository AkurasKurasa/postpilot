import { config } from "./config.js";
import { db } from "./db/index.js";
import { app } from "./app.js";

// Connection strings carry the database password; never print it to logs.
const safeUri = (uri) => uri.replace(/\/\/[^@/]*@/, "//***@");

try {
  await db.connect();
} catch (e) {
  console.error(`\nCould not connect to MongoDB at ${safeUri(config.mongoUri)}\n${e.message}\n` +
    "Start MongoDB, set MONGODB_URI in server/.env, or set DB_MODE=memory to try the app without a database.\n");
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`PostPilot API on http://localhost:${config.port}`);
  console.log(`  agents: ${config.llmMode === "mock" ? "mock (no API key)" : config.model}   database: ${config.dbMode === "memory" ? "in-memory" : safeUri(config.mongoUri)}`);
});
