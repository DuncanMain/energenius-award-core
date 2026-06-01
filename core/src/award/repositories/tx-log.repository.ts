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
      },
    });
  }

  /**
   * Find recent transactions for a user, ordered by creation date descending
   */
  async findRecentByUid(uidNew: string, limit: number = 10) {
    return this.prisma.txLog.findMany({
      where: { uidNew },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Find all transactions for a user, ordered by creation date descending
   */
  async findAllByUid(uidNew: string) {
    return this.prisma.txLog.findMany({
      where: { uidNew },
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
      },
    });
  }

  async countTodayByUidAndAwardRuleId(
    uidNew: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return tx.txLog.count({
      where: {
        uidNew,
        eventId: awardRuleId,
        createdAt: { gte: startOfDay },
      },
    });
  }

  async findTodayByUid(uidNew: string, startOfDay: Date) {
    return this.prisma.txLog.findMany({
      where: {
        uidNew,
        createdAt: { gte: startOfDay },
        type: 'award',
      },
      select: { eventId: true },
    });
  }

  async sumTodayAwardsByUid(
    uidNew: string,
    tx: Prisma.TransactionClient
  ): Promise<number> {
    const startOfDay = dayjs.utc().startOf('day').toDate();

    const result = await tx.txLog.aggregate({
      where: {
        uidNew: uidNew,
        type: 'award',
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }
}
