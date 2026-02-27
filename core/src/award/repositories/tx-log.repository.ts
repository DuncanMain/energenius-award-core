import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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

  /**
   * Kreiraj novi tx log
   */
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
   * Pronađi zadnjih N transakcija za korisnika
   */
  async findRecentByUid(uid: string, limit: number = 10) {
    return this.prisma.txLog.findMany({
      where: { uid },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Pronađi sve transakcije za korisnika
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
}
