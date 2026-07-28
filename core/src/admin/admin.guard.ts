import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermissionEnum } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ADMIN_PERMISSIONS_KEY } from './admin-permissions.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const subject = request.user?.sub ?? request.user?.nexus_user_id;
    if (!subject) throw new ForbiddenException('Admin identity is unavailable');

    const admin = await this.prisma.adminPrincipal.findUnique({
      where: { nexusSubject: String(subject) },
    });
    if (!admin?.enabled) throw new ForbiddenException('Admin access denied');

    const required =
      this.reflector.getAllAndOverride<AdminPermissionEnum[]>(
        ADMIN_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()]
      ) ?? [];
    if (!required.every(permission => admin.permissions.includes(permission))) {
      throw new ForbiddenException('Missing admin permission');
    }

    request.admin = admin;
    request.adminSubject = String(subject);
    return true;
  }
}
