import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminPermissionEnum } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    const subjects = (this.config.get<string>('ADMIN_NEXUS_SUBJECTS') ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const permissions = Object.values(AdminPermissionEnum);
    for (const nexusSubject of subjects) {
      await this.prisma.adminPrincipal.upsert({
        where: { nexusSubject },
        update: {},
        create: { nexusSubject, enabled: true, permissions },
      });
    }
  }
}
