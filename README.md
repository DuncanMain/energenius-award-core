# ENERGENIUS Award System

NestJS/PostgreSQL Core, ENcoin blockchain integration, Nexus authentication, scheduled reconciliation and a Next.js administrator dashboard.

Existing partner APIs remain under `/v1`. New administrator APIs are additive under `/v1/admin` and require an enabled Nexus `sub` in `admin_principals` with the relevant permission.

## Administrator bootstrap

Set `ADMIN_NEXUS_SUBJECTS` to comma-separated Nexus `sub` values. Bootstrap creates missing administrators only; restarts do not overwrite database-managed permissions or re-enable disabled accounts.

## Development

See [README-DEV-DOCKER.md](README-DEV-DOCKER.md). UI-only preview requires both `ADMIN_PREVIEW_MODE=true` and `NEXT_PUBLIC_ADMIN_PREVIEW_MODE=true`; never enable these in production.

## Deployment

See [README-DEPLOYMENT.md](README-DEPLOYMENT.md). Apply Prisma migrations before starting the updated Core.

## Verification

```bash
cd core
npm ci
npx prisma validate
npm test -- --runInBand
npm run build

cd ../frontend
npm ci
npm run build
```
