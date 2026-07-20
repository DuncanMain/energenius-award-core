import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { dayjs } from '@/utils/dayjs';

export interface CreateTxLogDto {
  uid: string;
  address: string;
  type: 'award' | 'spend';
  eventId?: string | null;
  label?: string | null;
  amount: string;
  txHash: string;
  chainId: number;
  eventTimestamp?: Date | null;
  source?: string | null;
  blockNumber?: bigint | null;
  blockHash?: string | null;
  logIndex?: number | null;
  confirmedAt?: Date | null;
  chainOperationId?: string | null;
}

@Injectable()
export class TxLogRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateTxLogDto) {
    return this.prisma.txLog.create({
      data: {
        uid: data.uid,
        address: data.address,
        type: data.type,
        eventId: data.eventId ?? null,
        label: data.label ?? null,
        amount: data.amount.toString(),
        txHash: data.txHash,
        chainId: data.chainId,
        eventTimestamp: data.eventTimestamp ?? null,
        source: data.source ?? null,
        blockNumber: data.blockNumber ?? null,
        blockHash: data.blockHash ?? null,
        logIndex: data.logIndex ?? null,
        confirmedAt: data.confirmedAt ?? null,
        chainOperationId: data.chainOperationId ?? null,
      },
    });
  }

  /**
   * Find recent transactions for a user, ordered by creation date descending
   */
  async findRecentByUid(uid: string, limit: number = 10) {
    return this.prisma.txLog.findMany({
      where: { uid },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Find all transactions for a user, ordered by creation date descending
   */
  async findAllByUid(uid: string) {
    return this.prisma.txLog.findMany({
      where: { uid },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Pronađi transakciju po txHash
   */
  async findByTxHash(txHash: string) {
    return this.prisma.txLog.findFirst({
      where: { txHash },
    });
  }

  /**
   * Kreiraj tx log unutar transakcije
   */
  async createInTransaction(
    data: CreateTxLogDto,
    tx: Prisma.TransactionClient
  ) {
    return tx.txLog.create({
      data: {
        uid: data.uid,
        address: data.address,
        type: data.type,
        eventId: data.eventId ?? null,
        label: data.label ?? null,
        amount: data.amount.toString(),
        txHash: data.txHash,
        chainId: data.chainId,
        eventTimestamp: data.eventTimestamp ?? null,
        source: data.source ?? null,
        blockNumber: data.blockNumber ?? null,
        blockHash: data.blockHash ?? null,
        logIndex: data.logIndex ?? null,
        confirmedAt: data.confirmedAt ?? null,
        chainOperationId: data.chainOperationId ?? null,
      },
    });
  }

  async countTodayByUidAndAwardRuleId(
    uid: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return tx.txLog.count({
      where: {
        uid,
        eventId: awardRuleId,
        createdAt: { gte: startOfDay },
      },
    });
  }

  async findTodayByUid(uid: string, startOfDay: Date) {
    return this.prisma.txLog.findMany({
      where: {
        uid,
        createdAt: { gte: startOfDay },
        type: 'award',
      },
      select: { eventId: true },
    });
  }

  async sumTodayAwardsByUid(
    uid: string,
    tx: Prisma.TransactionClient
  ): Promise<number> {
    const startOfDay = dayjs.utc().startOf('day').toDate();

    const result = await tx.txLog.aggregate({
      where: {
        uid: uid,
        type: 'award',
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }
}
