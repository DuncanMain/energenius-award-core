# Dev Docker Flow

This repo has a dedicated Compose environment for local development:

- backend: `energenius-award-core-dev` on `http://localhost:3001/v1`
- Swagger: `http://localhost:3001/v1/api-docs`
- frontend: `energenius-award-frontend-dev` on `http://localhost:3000`
- database: `energenius-award-db-dev`, exposed on host port `5433`
- Docker network: `energenius-dev`

## Start

```bash
docker compose -f docker-compose.dev.yml up --build
```

Run in the background:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Stop without deleting data:

```bash
docker compose -f docker-compose.dev.yml down
```

Reset the dev database and dependency volumes:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## Environment

The dev Compose file does not load `core/.env`. It provides its own Docker-specific values for `DATABASE_URL`, file storage paths, JWT dev secrets, Nexus URLs, and chain defaults so it does not accidentally reuse production settings from the backend env file.

Optional root-level Compose overrides live in `.env.docker.dev.example`:

```bash
cp .env.docker.dev.example .env
```

Only copy it if you need to change ports, database credentials, or local container URLs. Dev-specific overrides use `DEV_` prefixes so generic production variables like `NEXUS_URL`, `DATABASE_URL`, or `AMOY_RPC_URL` are not picked up accidentally.

The default chain settings only let the backend boot. Point `AMOY_RPC_URL`, `CHAIN_ID`, `ENCOIN_CONTRACT_ADDRESS`, and `AMOY_PRIVATE_KEY` at your real local chain when you need award/spend transactions to execute.

## Talk To Other Local Containers

The dev stack creates a named Docker network:

```bash
energenius-dev
```

Any other local container that should be reachable from this app must join that same network.

For an already-running container:

```bash
docker network connect energenius-dev <container-name>
```

For a new container:

```bash
docker run --network energenius-dev --name nexus-app ...
```

Then use the container name or network alias in URLs from the backend container, for example:

```env
DEV_NEXUS_URL=http://nexus-app:3003
DEV_TOKEN_INTROSPECTION_URL=http://nexus-app:3003/auth/token/introspect
```

For a service running directly on your host machine instead of in Docker, use:

```env
DEV_NEXUS_URL=http://host.docker.internal:3003
```

Browser-facing frontend variables are different: they must use URLs reachable from your browser, usually `localhost`, for example:

```env
DEV_NEXT_PUBLIC_API_URL=http://localhost:3001/v1
DEV_NEXT_PUBLIC_NEXUS_API_URL=http://localhost:3003
```

## Prisma

Generate Prisma client inside the backend container:

```bash
docker compose -f docker-compose.dev.yml exec core npm run prisma:generate
```

Run migrations against the dev database:

```bash
docker compose -f docker-compose.dev.yml exec core npx prisma migrate dev
```

Seed data:

```bash
docker compose -f docker-compose.dev.yml exec core npx ts-node prisma/seed/seed.ts
```

## Administrator access and UI preview

Set `DEV_ADMIN_NEXUS_SUBJECTS` to a Nexus user `sub` to bootstrap local administrator access.

For frontend-only design work without Nexus or Core, create the ignored file `frontend/.env.local` with:

```env
ADMIN_PREVIEW_MODE=true
NEXT_PUBLIC_ADMIN_PREVIEW_MODE=true
```

Preview records are fixtures and preview writes are no-ops. Never enable preview mode in production.
