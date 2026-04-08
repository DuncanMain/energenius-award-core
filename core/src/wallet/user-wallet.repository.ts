import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserWalletRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Find wallet by UID
   */
  async findByUid(uid: string) {
    return this.prisma.userWallet.findUnique({
      where: { uid },
    });
  }

  /**
   * Create or update wallet for a user (upsert)
   */
  async upsert(uid: string, address: string) {
    return this.prisma.$transaction(
      async tx => {
        const existing = await tx.userWallet.findUnique({ where: { uid } });
        if (existing) return existing;
        return tx.userWallet.create({ data: { uid, address } });
      },
      {
        isolationLevel: 'Serializable',
      }
    );
  }
  /**
   * Create wallet for a user (only if it doesn't exist)
   */
  async create(uid: string, address: string) {
    return this.prisma.userWallet.create({
      data: { uid, address },
    });
  }
}
