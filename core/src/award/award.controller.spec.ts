import { Test, TestingModule } from '@nestjs/testing';
import { IntrospectionGuard } from '@/auth/guards/introspectToken.guard';
import { IsComponentGuard } from '@/auth/guards/isComponent.guard';
import { AwardController } from './award.controller';
import { AwardService } from './award.service';
import { AwardTableService } from './award-table.service';

describe('AwardController', () => {
  let controller: AwardController;
  const awardService = {
    awardEvent: jest.fn(),
    getAvailableAwardsForUser: jest.fn(),
  };
  const awardTableService = {
    listAwardRules: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AwardController],
      providers: [
        { provide: AwardService, useValue: awardService },
        { provide: AwardTableService, useValue: awardTableService },
      ],
    })
      .overrideGuard(IntrospectionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(IsComponentGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AwardController>(AwardController);
  });

  it('passes component token and target user to award service', async () => {
    awardService.awardEvent.mockResolvedValue({ txHash: '0xabc' });

    await expect(
      controller.awardEvent(
        {
          eventId: 'enplay_purchase_res_item',
          targetUserId: 'nexus-user-uid',
          timestamp: '2026-07-02T10:00:00.000Z',
          source: 'data-beacon-smoke',
        },
        'Bearer component-token',
        { user: { azp: 'component-client' } }
      )
    ).resolves.toEqual({ txHash: '0xabc' });

    expect(awardService.awardEvent).toHaveBeenCalledWith(
      'nexus-user-uid',
      'enplay_purchase_res_item',
      {
        timestamp: '2026-07-02T10:00:00.000Z',
        source: 'data-beacon-smoke',
        componentToken: 'component-token',
        componentIdentity: 'component-client',
      }
    );
  });

  it('lists award rules', async () => {
    const rules = [{ id: 'rule-id', eventId: 'first_login' }];
    awardTableService.listAwardRules.mockResolvedValue(rules);

    await expect(controller.awardsAll()).resolves.toBe(rules);
  });

  it('uses Nexus user id from introspection claims for available awards', async () => {
    const awards = [{ event_id: 'first_login', is_available: true }];
    awardService.getAvailableAwardsForUser.mockResolvedValue(awards);

    await expect(controller.getAvailable('nexus-user-uid')).resolves.toBe(
      awards
    );

    expect(awardService.getAvailableAwardsForUser).toHaveBeenCalledWith(
      'nexus-user-uid'
    );
  });
});
