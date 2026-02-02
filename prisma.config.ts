import 'dotenv/config';
import { defineConfig } from 'prisma/config'

// Safety check: Verify the variable exists
if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL is missing in prisma.config.ts!");
  // If we are in production, we crash the app so we know something is wrong.
  if (process.env.NODE_ENV === 'production') {
     throw new Error("DATABASE_URL is not set.");
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
})