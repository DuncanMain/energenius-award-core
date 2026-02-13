// app/wallet/components/WalletBalance.tsx
"use client";
import { TrendingUp } from "lucide-react";

interface WalletBalanceProps {
  balance: number;
  onCredit: (amount: number) => void;
  spend: (amount: number, label?: string, onSuccess?: (data: any) => void) => Promise<void>;
}

export default function WalletBalance({
  balance,
  onCredit,
  spend
}: WalletBalanceProps) {
  const handleSpend = () => {
    spend(50, "Coffee", ({ txHash, amount, label }) => {
      console.log(`Tx confirmed: ${txHash}, spent $${amount} for ${label}`);
      // ovde može toast ili modal
    });
  };

  return (
    <div className="lg:col-span-2 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-3xl p-8 shadow-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-cyan-100 mb-2">Total Balance</p>
          <h2 className="text-5xl font-bold">${balance}</h2>
          <button
            onClick={handleSpend}
            className="mt-2 bg-cyan-500 px-4 py-2 rounded"
          >
            Spend $50
          </button>
        </div>
        <div className="bg-white/20 p-3 rounded-xl">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onCredit(100)}
          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold"
        >
          Add $100
        </button>
        <button
          onClick={() => onCredit(50)}
          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold"
        >
          Add $50
        </button>
      </div>
    </div>
  );
}

