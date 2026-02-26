import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
      seed: 'ts-node prisma/seed/seed_award_rule.ts',
    },
    datasource: {
       url: process.env.DATABASE_URL
    },
  })
