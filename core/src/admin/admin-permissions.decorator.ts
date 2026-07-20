import { SetMetadata } from '@nestjs/common';
import { AdminPermissionEnum } from '@prisma/client';

export const ADMIN_PERMISSIONS_KEY = 'admin_permissions';
export const RequireAdminPermissions = (
  ...permissions: AdminPermissionEnum[]
) => SetMetadata(ADMIN_PERMISSIONS_KEY, permissions);
