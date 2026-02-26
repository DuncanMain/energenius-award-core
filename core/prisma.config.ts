import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
      seed: 'ts-node prisma/seed/seed_award_rule.ts',
    },
    datasource: {
      url: env("DATABASE_URL"),
    },
});
