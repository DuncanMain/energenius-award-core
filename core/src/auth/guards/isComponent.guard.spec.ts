import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IsComponentGuard } from './isComponent.guard';

describe('IsComponentGuard', () => {
  let guard: IsComponentGuard;

  const createContext = (user: unknown) =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new IsComponentGuard();
  });

  it('allows Nexus component tokens by token_type', () => {
    expect(guard.canActivate(createContext({ token_type: 'COMPONENT' }))).toBe(
      true
    );
  });

  it('allows legacy component role tokens', () => {
    expect(
      guard.canActivate(
        createContext({ realm_access: { roles: ['component_role'] } })
      )
    ).toBe(true);
  });

  it('allows legacy client credential tokens', () => {
    expect(guard.canActivate(createContext({ azp: 'component-client' }))).toBe(
      true
    );
  });

  it('rejects user tokens', () => {
    expect(() =>
      guard.canActivate(
        createContext({
          token_type: 'USER',
          sub: 'keycloak-user-id',
          nexus_user_id: 'nexus-user-uid',
          email: 'user@test.com',
        })
      )
    ).toThrow(new ForbiddenException('Only components can call this.'));
  });
});
