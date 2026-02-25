import { ApiResponse } from './apiResponse';
import { BaseApi } from './baseApi';
import { authFetch } from './fetchClient';
import { Wallet } from '@/models/wallet';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '/v1').replace(
  /\/+$/,
  ''
);

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
      authFetch(`${API_BASE_URL}/wallets/${uid}/credit`, {
        method: 'POST',
        body: JSON.stringify({ amount, description }),
      })
    );
  }

}

export const walletApi = new WalletApi();
