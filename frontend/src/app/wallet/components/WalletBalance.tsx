// app/wallet/components/WalletBalance.tsx
'use client';
import { TrendingUp } from "lucide-react";

interface WalletBalanceProps {
  balance: number;
  onCredit: (amount: number) => void;
}

export default function WalletBalance({ balance, onCredit }: WalletBalanceProps) {
  return (
    <div className="lg:col-span-2 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-3xl p-8 shadow-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-cyan-100 mb-2">Total Balance</p>
          <h2 className="text-5xl font-bold">${parseFloat(balance.toString()).toFixed(2)}</h2>
        </div>
        <div className="bg-white/20 p-3 rounded-xl">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onCredit(100)} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold">Add $100</button>
        <button onClick={() => onCredit(50)} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold">Add $50</button>
      </div>
    </div>
  );
}