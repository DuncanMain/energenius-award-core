export interface Wallet {
  balance_wei: string;
  history: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  amount: string;
  type: 'credit' | 'debit';
  createdAt: string;
}

export interface SpendResponse {
  txHash: string;
  address: string;
  newBalanceWei: string;
}