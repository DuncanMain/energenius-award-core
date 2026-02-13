'use client';
import { TransactionType } from '@/enums/TransactionType.enum';
import React from 'react';

interface TransactionItemProps {
  tx: {
    txId: string;
    description: string;
    label: string;
    createdAt: string;
    type: TransactionType;
    amountWei: number;
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
        className={`font-bold ${tx.type === TransactionType.AWARD ? 'text-green-400' : 'text-red-400'}`}
      >
        {tx.type === TransactionType.AWARD ? '+' : '-'}${tx.amountWei}
      </div>
    </div>
  );
}
