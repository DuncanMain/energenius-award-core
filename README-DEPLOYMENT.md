# ENERGENIUS Award System deployment

## Compatibility

This release adds administrator routes and operational persistence. It does not intentionally change existing partner routes, component authentication or partner request bodies. Nexus remains the token issuer and introspection authority. Component/source matching is observation-only by default.

## Configuration

Core retains its existing database, Nexus and blockchain variables and adds:

```env
ADMIN_NEXUS_SUBJECTS=<initial-admin-nexus-sub>
CHAIN_SYNC_ENABLED=true
CHAIN_CONFIRMATIONS=1
CHAIN_SYNC_CHUNK_SIZE=1000
CHAIN_SYNC_START_BLOCK=0
```

Frontend server-side proxy:

```env
CORE_API_URL=https://<award-host>/v1
NEXUS_API_URL=https://<nexus-host>
NEXT_PUBLIC_API_URL=https://<award-host>/v1
NEXT_PUBLIC_NEXUS_API_URL=https://<nexus-host>
```

Never enable `ADMIN_PREVIEW_MODE` or `NEXT_PUBLIC_ADMIN_PREVIEW_MODE` in production.

## Safe deployment order

1. Back up PostgreSQL.
2. Build both images.
3. Run `npx prisma migrate deploy` using the release Core image and production `DATABASE_URL`.
4. If preflight reports duplicate reward-event IDs, stop and reconcile those rows before retrying.
5. Start Core and verify `/v1/admin/system/health` with an authorised administrator.
6. Start the frontend and verify Nexus login and permission-aware navigation.
7. Run reconciliation and confirm the cursor advances without unexplained failures.
8. Test a known existing partner award request without changing its payload.

`ADMIN_NEXUS_SUBJECTS` may be set initially or later followed by a Core restart. Once administrators exist, manage them through the dashboard.

## Rollback

Application rollback does not reverse database migrations. These schema changes are additive; retain the migrated database unless a separately reviewed rollback migration is supplied. Never reset production data.
