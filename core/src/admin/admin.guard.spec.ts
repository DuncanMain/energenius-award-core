import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermissionEnum } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const prisma = { adminPrincipal: { findUnique: jest.fn() } };
  const request: any = { user: { sub: 'nexus-admin' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
  const guard = new AdminGuard(
    reflector as unknown as Reflector,
    prisma as unknown as PrismaService
  );

  beforeEach(() => jest.clearAllMocks());

  it('authorizes a locally enabled Nexus subject with the permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      AdminPermissionEnum.ADMIN_SYSTEM_HEALTH_READ,
    ]);
    prisma.adminPrincipal.findUnique.mockResolvedValue({
      enabled: true,
      permissions: [AdminPermissionEnum.ADMIN_SYSTEM_HEALTH_READ],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.adminSubject).toBe('nexus-admin');
  });

  it('rejects an authenticated Nexus subject absent from local admin access', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    prisma.adminPrincipal.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException
    );
  });
});
