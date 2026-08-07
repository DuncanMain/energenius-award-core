import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { AwardService } from '@/award/award.service';

describe('WalletController', () => {
  let controller: WalletController;
  const spend = jest.fn();

  beforeEach(async () => {
    spend.mockReset().mockResolvedValue({ txHash: '0xabc' });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        { provide: WalletService, useValue: {} },
        { provide: AwardService, useValue: { spend } },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Regression: the request body `amount` is a JS number (class-validator @IsInt does not coerce
  // to bigint). The controller MUST convert it before AwardService.spend, whose math is bigint-only
  // — a raw number reaches `pendingEnc + amountEnc` and throws "Cannot mix BigInt and other types".
  it('converts the numeric request amount to a bigint before spending', async () => {
    await controller.spend(
      { amount: 1, label: 'gift' } as any,
      { user: { nexus_user_id: 'uid-1' } } as any
    );
    expect(spend).toHaveBeenCalledTimes(1);
    const [uid, amount, label] = spend.mock.calls[0];
    expect(uid).toBe('uid-1');
    expect(typeof amount).toBe('bigint');
    expect(amount).toBe(1n);
    expect(label).toBe('gift');
  });
});
