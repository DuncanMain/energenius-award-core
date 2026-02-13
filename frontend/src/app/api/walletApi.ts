import { ApiResponse } from './apiResponse';
import { BaseApi } from './baseApi';
import { authFetch } from './fetchClient';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';

interface Wallet {
  balanceWei: string;
  history: any[];
}
interface Award {
  id: string;
  name: string;
  description: string;
}

class WalletApi extends BaseApi {
  async getWallet(uid: string): Promise<ApiResponse<Wallet>> {
    return this.handleRequest(() => authFetch(`${API_BASE_URL}/wallet/${uid}`));
  }

  async createWallet(
    uid: string,
    address: string
  ): Promise<ApiResponse<Wallet>> {
    return this.handleRequest(() =>
      authFetch(`${API_BASE_URL}/wallets`, {
        method: 'POST',
        body: JSON.stringify({ uid, address }),
      })
    );
  }

  async creditWallet(
    uid: string,
    amount: number,
    description: string
  ): Promise<ApiResponse<Wallet>> {
    return this.handleRequest(() =>
      authFetch(`/wallets/${uid}/credit`, {
        method: 'POST',
        body: JSON.stringify({ amount, description }),
      })
    );
  }

  async claimAward(uid: string, eventId: string): Promise<ApiResponse<Wallet>> {
    return this.handleRequest(() =>
      authFetch(`/wallets/${uid}/award`, {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      })
    );
  }

  async getAwards(): Promise<ApiResponse<Award[]>> {
    return this.handleRequest(() => authFetch(`/award`));
  }
}

export const walletApi = new WalletApi();
