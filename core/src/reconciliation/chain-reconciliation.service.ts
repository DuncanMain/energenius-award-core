import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { formatUnits } from 'ethers';
import { ChainService } from '@/chain/chain.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ChainReconciliationService {
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly config: ConfigService
  ) {}

  @Cron('*/30 * * * * *')
  async scheduledSync() {
    if (this.config.get<string>('CHAIN_SYNC_ENABLED') === 'false') return;
    await this.syncOnce();
  }

  async syncOnce() {
    if (this.running) return { skipped: true, reason: 'already-running' };
    this.running = true;
    try {
      const chainId = this.chain.getChainId();
      const confirmations = Number(
        this.config.get<string>('CHAIN_CONFIRMATIONS') ?? '5'
      );
      const chunkSize = Number(
        this.config.get<string>('CHAIN_SYNC_CHUNK_SIZE') ?? '1000'
      );
      const head = await this.chain.getBlockNumber();
      const safeHead = Math.max(0, head - confirmations);
      const cursor = await this.prisma.chainSyncCursor.findUnique({
        where: { chainId },
      });
      const configuredStart = Number(
        this.config.get<string>('CHAIN_SYNC_START_BLOCK') ?? '0'
      );
      const fromBlock = cursor
        ? Number(cursor.lastProcessedBlock) + 1
        : configuredStart;
      if (fromBlock > safeHead) {
        await this.recheckSubmittedOperations();
        return { fromBlock, toBlock: safeHead, processed: 0 };
      }

      const toBlock = Math.min(safeHead, fromBlock + chunkSize - 1);
      const events = await this.chain.transferEvents(fromBlock, toBlock);
      for (const event of events) await this.reconcileTransfer(event as any);

      await this.prisma.chainSyncCursor.upsert({
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
      await this.recheckSubmittedOperations();
      return { fromBlock, toBlock, processed: events.length };
    } finally {
      this.running = false;
    }
  }

  private async reconcileTransfer(event: any) {
    const args = event.args;
    if (!args) return;
    const from = String(args.from);
    const to = String(args.to);
    const amount = formatUnits(BigInt(args.value.toString()), 18);
    const treasury = (await this.chain.treasury()).toLowerCase();
    const type =
      from.toLowerCase() === treasury
        ? 'award'
        : to.toLowerCase() === treasury
          ? 'spend'
          : null;
    if (!type) return;

    const userAddress = type === 'award' ? to : from;
    const wallet = await this.prisma.userWallet.findFirst({
      where: { address: { equals: userAddress, mode: 'insensitive' } },
    });
    if (!wallet?.uid) return;

    const txHash = String(event.transactionHash);
    const chainId = this.chain.getChainId();
    const operation = await this.prisma.chainOperation.findUnique({
      where: { chainId_txHash: { chainId, txHash } },
    });

    await this.prisma.$transaction(async tx => {
      const existing = await tx.txLog.findFirst({
        where: { chainId, txHash },
      });
      if (existing) {
        await tx.txLog.update({
          where: { id: existing.id },
          data: {
            status: 'CONFIRMED',
            blockNumber: BigInt(event.blockNumber),
            blockHash: event.blockHash,
            logIndex: event.index,
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
            logIndex: event.index,
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
    });
  }

  private async recheckSubmittedOperations() {
    const operations = await this.prisma.chainOperation.findMany({
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
        await this.prisma.chainOperation.update({
          where: { id: operation.id },
          data: { status: 'FAILED', failureReason: 'Transaction reverted' },
        });
      }
    }
  }
}
