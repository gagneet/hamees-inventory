import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env file explicitly so DATABASE_URL is available when running Prisma CLI
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Copy .env.example to .env and fill it in.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
