import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserWalletRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Pronađi wallet po UID-u
   */
  async findByUid(uid: string) {
    return this.prisma.userWallet.findUnique({
      where: { uid },
    });
  }

  /**
   * Kreiraj wallet ili ignoriši ako već postoji (upsert)
   */
  async upsert(uid: string, address: string) {
    return this.prisma.userWallet.upsert({
      where: { uid },
      update: {},
      create: { uid, address },
    });
  }

  /**
   * Kreiraj wallet (samo ako ne postoji)
   */
  async create(uid: string, address: string) {
    return this.prisma.userWallet.create({
      data: { uid, address },
    });
  }
}
