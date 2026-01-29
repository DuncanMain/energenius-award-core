# EG Award Core (PH1)

Backend core for the ENERGENIUS Award System — **Phase 1**.

This repository implements the backend logic for awarding and spending ENCoins using a **custodial, backend-first model**.  
It is designed to be reusable with any compatible award-token smart contract.

No frontend and no HTTP API are included at this stage.

---

## SCOPE (PH1)

Phase 1 is intentionally constrained:

- Backend-first
- Custodial (single treasury wallet)
- No user-managed wallets
- No frontend ↔ blockchain interaction
- All blockchain transactions signed by the backend
- Eligibility, limits, and auditability enforced **off-chain**
- Blockchain used as an execution layer only

---

## ARCHITECTURE OVERVIEW

### System of Record

- **PostgreSQL** is the authoritative source for:
  - award limits
  - award history
  - auditability

On-chain state is **never trusted** for eligibility decisions.

### Blockchain

- ERC-20 compatible award token
- Backend signs all transactions using a treasury private key
- Transactions wait for confirmation (`tx.wait()`)

### Wallet Model

- Deterministic wallets derived from a user ID (`uid`)
- Same UID → same address, always
- Users never see or control private keys

---

## CORE CAPABILITIES

### Awarding

- Award tokens for predefined events
- Enforce `maxCount` per event
- Optional event timestamp and source metadata
- All awards go through a single core function

### Spending

- Debit tokens from a user wallet
- Balance checked on-chain before spending
- All spends logged for auditability

### Read-only Queries

- Wallet snapshot (balance + recent history)
- Available awards for a user
- Award rules list

---

## AWARD RULES

Awardable events are defined in:
award-table.json

Example:

```json
{
  "id": "first_login",
  "title": "First login",
  "encAmount": "10",
  "maxCount": 1
}

- encAmount is expressed in whole tokens
- Converted internally using 18 decimals
- maxCount = 0 means unlimited
- Rules are loaded at startup and treated as immutable during runtime

## DATABASE

Schema definition:
schema.sql

# Core tables:
- user_wallets
- user_awards
- tx_log

The database is the system of record for all award logic.

## SMART CONTRACT REQUIREMENTS

This backend expects a deployed award-token contract exposing:
- award(address,uint256)
- spend(address,uint256)
- balanceOf(address)
- owner()

Assumptions:
- ERC-20 compatible
- 18 decimals
- Treasury wallet is the contract owner

A reference smart-contract implementation lives in a separate repository.

## ENVIRONMENT VARIABLES
This deployment is on the polygon AMOY testnet, adjust to your own.

Create a local .env file (never committed):

AMOY_RPC_URL=
AMOY_PRIVATE_KEY=
DATABASE_URL=

## DEVELOPMENT SCRIPTS

Core functionality can be exercised without HTTP using dev runners:

-src/dev/runawardevent.ts
-src/dev/runspend.ts
-src/dev/runwalletsnapshot.ts
-src/dev/runawardsavailability.ts

These scripts call the same core functions that the HTTP API will later expose.