import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { ChainService } from '@/chain/chain.service';
import { UserWalletRepository } from './user-wallet.repository';
import { TxLogRepository } from '@/award/repositories/tx-log.repository';

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: ChainService, useValue: {} },
        { provide: UserWalletRepository, useValue: {} },
        { provide: TxLogRepository, useValue: {} },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
