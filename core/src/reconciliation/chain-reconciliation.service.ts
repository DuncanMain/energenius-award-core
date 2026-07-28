import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { formatUnits } from 'ethers';
import { Prisma } from '@prisma/client';
import { ChainService } from '@/chain/chain.service';
import { PrismaService } from '@/prisma/prisma.service';

// Postgres advisory-lock key for the reconciliation leader. hashtext() maps the label to an int.
const RECONCILIATION_LOCK_LABEL = 'energenius-chain-reconciliation';

@Injectable()
export class ChainReconciliationService {
  private readonly logger = new Logger(ChainReconciliationService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly config: ConfigService
  ) {}

  @Cron('*/30 * * * * *')
  async scheduledSync() {
    if (this.config.get<string>('CHAIN_SYNC_ENABLED') === 'false') return;
    try {
      await this.syncOnce();
    } catch (error) {
      // Never let a scheduled failure become an unhandled rejection; the next tick retries.
      this.logger.warn(
        `reconciliation tick failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reaper for orphaned two-phase operations. A crash between the decision transaction (which
   * commits a RESERVED op) and submission leaves a RESERVED row with no tx_hash that counts as
   * "pending" forever, permanently inflating a user's daily/per-user limits. RESERVED lifetime is
   * normally sub-second, so anything older than the TTL is safely orphaned → mark FAILED.
   */
  @Cron('30 */5 * * * *')
  async reapStaleOperations() {
    const ttlMinutes = Number(
      this.config.get<string>('CHAIN_OP_RESERVED_TTL_MINUTES') ?? '15'
    );
    const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
    try {
      const { count } = await this.prisma.chainOperation.updateMany({
        where: { status: 'RESERVED', txHash: null, createdAt: { lt: cutoff } },
        data: {
          status: 'FAILED',
          failureReason: 'Reserved operation expired without submission',
        },
      });
      if (count > 0) {
        this.logger.log(`Reaped ${count} stale RESERVED operation(s)`);
      }
      return { reaped: count };
    } catch (error) {
      this.logger.warn(
        `reaper failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return { reaped: 0 };
    }
  }

  async syncOnce() {
    // In-process guard (fast path) plus a Postgres advisory lock so multiple replicas can't
    // double-process the same block range and stall the cursor on P2002.
    if (this.running) return { skipped: true, reason: 'already-running' };
    this.running = true;
    try {
      return await this.prisma.$transaction(
        async tx => {
          const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(hashtext(${RECONCILIATION_LOCK_LABEL})) AS locked
          `;
          if (!locked) {
            return { skipped: true, reason: 'locked-by-another-instance' };
          }

          const chainId = this.chain.getChainId();
          const confirmations = Number(
            this.config.get<string>('CHAIN_CONFIRMATIONS') ?? '5'
          );
          const chunkSize = Number(
            this.config.get<string>('CHAIN_SYNC_CHUNK_SIZE') ?? '1000'
          );
          const head = await this.chain.getBlockNumber();
          const safeHead = Math.max(0, head - confirmations);
          const cursor = await tx.chainSyncCursor.findUnique({
            where: { chainId },
          });
          const configuredStart = Number(
            this.config.get<string>('CHAIN_SYNC_START_BLOCK') ?? '0'
          );
          const fromBlock = cursor
            ? Number(cursor.lastProcessedBlock) + 1
            : configuredStart;
          if (fromBlock > safeHead) {
            await this.recheckSubmittedOperations(tx);
            return { fromBlock, toBlock: safeHead, processed: 0 };
          }

          const toBlock = Math.min(safeHead, fromBlock + chunkSize - 1);
          // Cache the treasury address once per run instead of per-event.
          const treasury = (await this.chain.treasury()).toLowerCase();
          const events = await this.chain.transferEvents(fromBlock, toBlock);
          for (const event of events)
            await this.reconcileTransfer(tx, event as any, treasury);

          await tx.chainSyncCursor.upsert({
            where: { chainId },
            update: {
              contractAddress: this.chain.getContractAddress(),
              lastProcessedBlock: BigInt(toBlock),
            },
            create: {
              chainId,
              contractAddress: this.chain.getContractAddress(),
              lastProcessedBlock: BigInt(toBlock),
            },
          });
          await this.recheckSubmittedOperations(tx);
          return { fromBlock, toBlock, processed: events.length };
        },
        // Generous timeout: the run holds the lock + connection across chain RPC calls, but only
        // at the 30s cadence and bounded by chunkSize. maxWait keeps non-leaders from queuing.
        { timeout: 120_000, maxWait: 5_000 }
      );
    } finally {
      this.running = false;
    }
  }

  private async reconcileTransfer(
    tx: Prisma.TransactionClient,
    event: any,
    treasury: string
  ) {
    const args = event.args;
    if (!args) return;
    const from = String(args.from);
    const to = String(args.to);
    const amount = formatUnits(BigInt(args.value.toString()), 18);
    const type =
      from.toLowerCase() === treasury
        ? 'award'
        : to.toLowerCase() === treasury
          ? 'spend'
          : null;
    if (!type) return;

    const userAddress = type === 'award' ? to : from;
    const wallet = await tx.userWallet.findFirst({
      where: { address: { equals: userAddress, mode: 'insensitive' } },
    });
    if (!wallet?.uid) return;

    const txHash = String(event.transactionHash);
    const chainId = this.chain.getChainId();
    const logIndex = event.index;
    const operation = await tx.chainOperation.findUnique({
      where: { chainId_txHash: { chainId, txHash } },
    });

    // Match the tx_log unique key (chainId, txHash, logIndex) so a transaction that emits
    // multiple Transfer logs produces distinct rows instead of overwriting the first.
    const existing = await tx.txLog.findFirst({
      where: { chainId, txHash, logIndex },
    });
    if (existing) {
      await tx.txLog.update({
        where: { id: existing.id },
        data: {
          status: 'CONFIRMED',
          blockNumber: BigInt(event.blockNumber),
          blockHash: event.blockHash,
          logIndex,
          confirmedAt: existing.confirmedAt ?? new Date(),
          lastCheckedAt: new Date(),
          failureReason: null,
        },
      });
    } else {
      await tx.txLog.create({
        data: {
          uid: wallet.uid!,
          address: userAddress,
          type,
          eventId: operation?.eventId ?? null,
          label: operation?.label ?? 'chain_reconciliation',
          amount,
          txHash,
          chainId,
          source: operation?.source ?? null,
          eventTimestamp: operation?.eventTimestamp ?? null,
          status: 'CONFIRMED',
          blockNumber: BigInt(event.blockNumber),
          blockHash: event.blockHash,
          logIndex,
          confirmedAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });
      if (
        operation?.status !== 'CONFIRMED' &&
        operation?.type === 'AWARD' &&
        operation.awardRuleId
      ) {
        await tx.userAward.upsert({
          where: {
            uid_awardRuleId: {
              uid: operation.uid,
              awardRuleId: operation.awardRuleId,
            },
          },
          update: { count: { increment: 1 } },
          create: {
            uid: operation.uid,
            awardRuleId: operation.awardRuleId,
            count: 1,
          },
        });
      }
    }
    if (operation && operation.status !== 'CONFIRMED') {
      await tx.chainOperation.update({
        where: { id: operation.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          failureReason: null,
        },
      });
    }
  }

  private async recheckSubmittedOperations(tx: Prisma.TransactionClient) {
    const operations = await tx.chainOperation.findMany({
      where: {
        status: { in: ['SUBMITTED', 'RECONCILIATION_REQUIRED'] },
        txHash: { not: null },
      },
      take: 100,
      orderBy: { updatedAt: 'asc' },
    });
    for (const operation of operations) {
      const receipt = await this.chain.getTransactionReceipt(operation.txHash!);
      if (receipt?.status === 0) {
        await tx.chainOperation.update({
          where: { id: operation.id },
          data: { status: 'FAILED', failureReason: 'Transaction reverted' },
        });
      }
    }
  }
}
