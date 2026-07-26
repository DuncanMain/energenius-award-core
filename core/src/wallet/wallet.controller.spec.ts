import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { AwardService } from '@/award/award.service';
import { AwardCoreError } from '@/utils/errors/award-core.error';

describe('WalletController', () => {
  let controller: WalletController;
  const walletService = { getWalletSnapshot: jest.fn() };
  const awardService = { spend: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        { provide: WalletService, useValue: walletService },
        { provide: AwardService, useValue: awardService },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the wallet snapshot for the token user', async () => {
    const snapshot = {
      uid: 'u1',
      address: '0x' + 'a'.repeat(40),
      balance_wei: '100',
      balance_available: true,
      history: [],
    };
    walletService.getWalletSnapshot.mockResolvedValue(snapshot);

    await expect(controller.getWallet('u1')).resolves.toEqual(snapshot);
    expect(walletService.getWalletSnapshot).toHaveBeenCalledWith('u1');
  });

  it('spend returns a structured error for AwardCoreError instead of throwing', async () => {
    awardService.spend.mockRejectedValue(
      new AwardCoreError('INSUFFICIENT_BALANCE', 'not enough tokens')
    );

    const result = await controller.spend(
      { amount: 5, label: 'x' } as any,
      { user: { nexus_user_id: 'u1' } }
    );

    expect(result).toEqual({ error: 'INSUFFICIENT_BALANCE', message: 'not enough tokens' });
  });
});
