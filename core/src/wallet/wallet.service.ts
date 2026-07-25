import { Injectable, Logger } from '@nestjs/common';
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
  // null when the on-chain balance could not be read (e.g. RPC unreachable). `balance_available`
  // tells the caller whether `balance_wei` is authoritative.
  balance_wei: string | null;
  balance_available: boolean;
  history: WalletHistoryItem[];
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private chainService: ChainService,
    private userWalletRepo: UserWalletRepository,
    private txLogRepo: TxLogRepository
  ) {}

  async getWalletSnapshot(uid: string): Promise<WalletSnapshot> {
    if (!uid || uid.trim() === '') {
      throw new Error('uid is required');
    }
    const address = deriveAddress(uid);

    await this.userWalletRepo.upsert(uid, address);

    // The on-chain balance depends on an external RPC (Amoy). A transient RPC outage must NOT
    // fail the whole snapshot with an opaque 500 — address + history are still useful (and this
    // is what broke /v1/wallet in prod while /v1/award/available kept working). Degrade instead.
    let balanceWei: string | null = null;
    let balanceAvailable = false;
    try {
      const balWei = await this.chainService.balanceOf(address);
      balanceWei = balWei.toString();
      balanceAvailable = true;
    } catch (error) {
      this.logger.warn(
        `balanceOf failed for ${address}; returning snapshot without balance: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }

    const txLogs = await this.txLogRepo.findRecentByUid(uid, 10);

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
      balance_wei: balanceWei,
      balance_available: balanceAvailable,
      history,
    };
  }
}
