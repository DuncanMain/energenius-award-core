import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed/seed_award_rule.ts',
  },
  datasource: {
    // Client generation does not connect to the database, so keep installs
    // deterministic even when deployment secrets are intentionally absent.
    url:
      process.env.DATABASE_URL ??
      'postgresql://award:award@localhost:5432/award',
  },
});
