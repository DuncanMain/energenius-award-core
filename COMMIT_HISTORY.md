# ENERGENIUS Award System — Commit History (May → Jul 2026)

> Detailed chronological analysis of the `dev` branch, 1 May → 12 Jul 2026 (15 commits incl. merges; 8 non-merge commits).
> For architecture see [`ANALYSIS.md`](./ANALYSIS.md). Cross-repo timeline: `energenius-nexus/ANALYSIS.md → A.6`.
> Version trajectory: **1.0.x → 1.1.1 (3 Jul)**.

This is the smallest and most stable of the three repos over the window — the core award/wallet logic was already in place, so the commits are mostly **adapting to the platform's new identity model** and coordinated release plumbing.

Legend: **PR** = merged pull request · files/±lines from `git --shortstat`.

---

## May — Sync guards to the new user uid (EN-183, EN-200)

| Date | Commit | PR | Scope | What it did |
|---|---|---|---|---|
| 22 May | `award-system-in-sync` | #35 (EN-183) | **20 files, +801/−239** | The window's biggest commit. Edited **guards to use the new user uid** — re-based the award/wallet/tx-log flow onto the platform-wide Nexus `uid` and synced the service with the new identity model. |
| 25 May | `version-updated` | — | 3 files | Version bump. |
| 26 May | `deploy-prepared` | #36 (EN-200) | 2 files, **+127** | Predeploy scripts config (coordinated across all three repos — the EN-200 release-tooling effort). |

---

## June — Event recipient targeting & uid standardization

| Date | Commit | PR | Scope | What it did |
|---|---|---|---|---|
| 1 Jun | `target-user-id-in-dto-for-event-create` | #38 (EN-201) | 4 files, +30/−25 | Added **`target_user_id`** to the award `EventDto` (`@Expose({ name: 'target_user_id' })`). This decouples the caller from the recipient: a **component authenticates as itself but awards a different user**. Core to the machine-to-machine award model. |
| 5 Jun | `uid-field-used-only-since-we-will-start-from-zero-in-award-system` | #40 (EN-203) | 6 files, +51/−48 | Standardized on the **`uid` field only** (Nexus user id string). Since the award system "starts from zero," it drops the legacy dual-id ambiguity and checks GET endpoints against the single uid. (The `uidNew` column remains in the schema as a vestige — code uses `uid`.) |

---

## Late June / July — Introspection verify & coordinated release

| Date | Commit | PR | Scope | What it did |
|---|---|---|---|---|
| 30 Jun | `EN-215: token-introspect-checked` | #42 | 4 files, +188/−2 | Verified/expanded the **Nexus token introspection guard** (coordinated across all three repos). |
| 2 Jul | `EN-235: predeploy-testing-done` | #43 | 5 files, +267/−9 | Predeploy end-to-end testing (coordinated). |
| 3 Jul | `verison-updated` | #44 | 3 files | Bump to **v1.1.1** (`version-update-03-07-2026`, coordinated release across all three services). |

---

## How this repo's timeline relates to the others

The Award System never drove the identity migration — it **followed** it:

1. When Nexus introduced `user_uid` (EN-180, May), Award System re-based its guards onto it (**EN-183**, 22 May).
2. When the platform settled the component-token model, Award System added **`target_user_id`** (EN-201) so components could award end users, and verified introspection (**EN-215**) — the same guard-verification done in Nexus and Data Beacon on the same day (30 Jun).
3. It participated in every coordinated checkpoint: **EN-200** (predeploy), **EN-235** (predeploy testing), and the **3 Jul version release** (PR #44, mirroring Nexus PR #102 and Data Beacon PR #47).

**Note:** there are no `EN-204`-numbered commits *here* — EN-204 ("post award event") was fixed on the **Nexus** side (the sender), while the receiver (`POST /v1/award/event` with `IsComponentGuard`) had already existed and only needed the `target_user_id` addition (EN-201).

---

## Reading the numbers

- **Low churn, high leverage:** only ~8 non-merge commits, but the 22 May `EN-183` re-base (+801/−239) touched the whole service to align it with the platform identity model.
- **Zero commits in the 6 Jun → 29 Jun gap:** while Nexus and Data Beacon were deep in the linkage-model rework, Award System was idle — it only needed to re-verify introspection at the end (30 Jun), confirming its integration is thin and stable.
- **Two `package.json`s** (`core/` backend + `frontend/`) both moved to 1.1.1 in lockstep.

*Generated from `git log --shortstat` analysis.*
