'use client';
import React from 'react';

interface TransactionItemProps {
  tx: {
    txId: string;
    label: string;
    createdAt: string;
    type: 'award' | 'debit';
    amountWei: string;
  };
}

export default function TransactionItem({ tx }: TransactionItemProps) {
  return (
    <div className="bg-slate-700 p-4 rounded-xl flex justify-between">
      <div>
        <div className="font-semibold">{tx.label}</div>
        <div className="text-xs text-slate-400">
          {new Date(tx.createdAt).toLocaleString()}
        </div>
      </div>
      <div
        className={`font-bold ${tx.type === 'award' ? 'text-green-400' : 'text-red-400'}`}
      >
        {tx.type === 'award' ? '+' : '-'}${tx.amountWei}
      </div>
    </div>
  );
}
