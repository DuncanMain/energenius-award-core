import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class IsComponentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const roles = user.realm_access?.roles || [];

    if (roles.includes('component_role')) return true;
    if (!user.email && !user.sid && user.azp) {
      return true;
    }

    throw new ForbiddenException('Only components can call this.');
  }
}
