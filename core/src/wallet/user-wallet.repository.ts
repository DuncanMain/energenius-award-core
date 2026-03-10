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
    return this.prisma.userWallet.upsert({
      where: { uid },
      update: {},
      create: { uid, address },
    });
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
