'use client';
import { TransactionType } from '@/enums/TransactionType.enum';
import { formatEventName } from '@/utils/formatEventName';
import React from 'react';

interface TransactionItemProps {
  tx: {
    txId: string;
    txHash?: string;
    description: string;
    label: string;
    createdAt: string;
    type: TransactionType;
    amountWei: number;
  };
}

export default function TransactionItem({ tx }: TransactionItemProps) {
  const content = (
    <div className="bg-slate-700 p-4 rounded-xl flex justify-between hover:bg-slate-600 transition-colors">
      <div>
        <div className="font-semibold">{formatEventName(tx.label)}</div>
        <div className="text-xs text-slate-400">
          {new Date(tx.createdAt).toLocaleString()}
        </div>
        {tx.txHash && (
          <div className="text-xs text-cyan-400 mt-1">
            {tx.txHash.slice(0, 12)}...
          </div>
        )}
      </div>
      <div
        className={`font-bold ${tx.type === TransactionType.AWARD ? 'text-green-400' : 'text-red-400'}`}
      >
        {tx.type === TransactionType.AWARD ? '+' : '-'}{tx.amountWei} ENC
      </div>
    </div>
  );

  if (!tx.txHash) return content;

  return (
    <a
      href={`https://amoy.polygonscan.com/tx/${tx.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className='my-2 block'
    >
      {content}
    </a>
  );
}