'use client';
import { formatBalance } from '@/utils/formatCurrency';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface WalletBalanceProps {
  balance: number | null;
  onCredit: (amount: number) => void;
  spend: (
    amount: number,
    label: string,
    onSuccess?: (data: any) => void
  ) => Promise<void>;
}

export default function WalletBalance({
  balance,
  onCredit,
  spend,
}: WalletBalanceProps) {
  const [loading, setLoading] = useState(false);

  const handleSpend = async () => {
    setLoading(true);
    await spend(5, 'EV charging', ({ txHash, amount, label }) => {
      console.log(`Tx confirmed: ${txHash}, spent $${amount} for ${label}`);
      toast.success(`Spent $${amount} for ${label}`);
      setLoading(false);
    });
    setLoading(false);
  };

  return (
    <div className="lg:col-span-2 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-3xl p-8 shadow-2xl h-max">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-cyan-100 mb-2">Total Balance</p>
          <h2 className="text-5xl font-bold">${formatBalance(balance)}</h2>
          <button
            onClick={handleSpend}
            className="mt-2 bg-cyan-500 px-4 py-2 rounded flex items-center gap-2"
          >
            {loading && <RefreshCw className={`w-4 h-4 animate-spin`} />}
            Spend $5
          </button>
        </div>
        <div className="bg-white/20 p-3 rounded-xl">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
