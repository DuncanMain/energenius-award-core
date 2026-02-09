import { Injectable } from '@nestjs/common';
import { deriveAddress } from '@/utils/wallet';
import { TxLogRepository } from '@/award/repositories/tx-log.repository';
import { ChainService } from '@/chain/chain.service';
import { UserWalletRepository } from './user-wallet.repository';

export interface WalletHistoryItem {
  type: string;
  eventId: string | null;
  label: string | null;
  amountWei: string;
  txHash: string;
  createdAt: string;
}

export interface WalletSnapshot {
  uid: string;
  address: string;
  balanceWei: string;
  history: WalletHistoryItem[];
}

@Injectable()
export class WalletService {
  constructor(
    private chainService: ChainService,
    private userWalletRepo: UserWalletRepository,
    private txLogRepo: TxLogRepository
  ) {}

  /**
   * Vraća trenutno stanje wallet-a (Business logika)
   */
  async getWalletSnapshot(uid: string): Promise<WalletSnapshot> {
    if (!uid || uid.trim() === '') {
      throw new Error('uid is required');
    }

    // Generiši adresu
    const address = deriveAddress(uid);

    // Repository: osiguraj da wallet postoji
    await this.userWalletRepo.upsert(uid, address);

    // Blockchain: provjeri balans
    const balWei = await this.chainService.balanceOf(address);

    // Repository: izvuci zadnjih 10 transakcija
    const txLogs = await this.txLogRepo.findRecentByUid(uid, 10);

    // Business logika: mapiranje u response format
    const history: WalletHistoryItem[] = txLogs.map(tx => ({
      type: tx.type,
      eventId: tx.eventId ?? null,
      label: tx.label ?? null,
      amountWei: tx.amount.toString(),
      txHash: tx.txHash,
      createdAt: tx.createdAt.toISOString(),
    }));

    return {
      uid,
      address,
      balanceWei: balWei.toString(),
      history,
    };
  }
}
