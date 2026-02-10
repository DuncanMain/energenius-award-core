import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

@Injectable()
export class IntrospectionGuard {
  constructor(
    private reflector: Reflector,
    private readonly configService: ConfigService
  ) {}
  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) throw new UnauthorizedException('Missing token');

    let introspectData: any;

    try {
      const introspectUrl = this.configService.get<string>(
        'TOKEN_INTROSPECTION_URL'
      );
      console.log(introspectUrl);
      if (!introspectUrl)
        throw new Error('TOKEN_INTROSPECTION_URL is not defined');

      const response = await fetch(introspectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      introspectData = await response.json();
    } catch (err) {
        console.log(err);
      throw new UnauthorizedException('Token introspection failed');
    }

    if (!introspectData.active) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = introspectData; // attach user info
    return true; // allow access
  }
}
