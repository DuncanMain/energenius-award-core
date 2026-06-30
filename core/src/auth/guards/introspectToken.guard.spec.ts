import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IntrospectionGuard } from './introspectToken.guard';

describe('IntrospectionGuard', () => {
  let guard: IntrospectionGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let configService: { get: jest.Mock };
  let mockFetch: jest.Mock;
  const originalFetch = global.fetch;

  const createContext = (authorization?: string) => {
    const request = {
      headers: authorization ? { authorization } : {},
      user: undefined as any,
    };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TOKEN_INTROSPECTION_URL: 'http://nexus.local/auth/token/introspect',
        };
        return values[key];
      }),
    };
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    guard = new IntrospectionGuard(
      reflector as unknown as Reflector,
      configService as unknown as ConfigService
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    global.fetch = originalFetch;
  });

  it('allows public endpoints without token introspection', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls the Nexus JSON introspection wrapper and attaches user claims', async () => {
    const introspectionData = {
      active: true,
      sub: 'keycloak-user-id',
      token_type: 'USER',
      nexus_user_id: 'nexus-user-uid',
      local_user_id: 'local-user-123',
      registration_key: 'pilot-key',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(introspectionData),
    });
    const { context, request } = createContext('Bearer user-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://nexus.local/auth/token/introspect',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: 'user-token' }),
      }
    );
    expect(request.user).toEqual(introspectionData);
  });

  it('attaches component token introspection data', async () => {
    const introspectionData = {
      active: true,
      azp: 'component-client',
      token_type: 'COMPONENT',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(introspectionData),
    });
    const { context, request } = createContext('Bearer component-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.user).toEqual(introspectionData);
  });

  it('rejects inactive tokens', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ active: false }),
    });
    const { context } = createContext('Bearer inactive-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token')
    );
  });

  it('rejects introspection request failures', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });
    const { context } = createContext('Bearer token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Token introspection failed')
    );
  });
});
