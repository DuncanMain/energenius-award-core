// app/wallet/components/TransactionList.tsx
'use client';
import TransactionItem from './TransactionItem';

interface TransactionListProps {
  transactions: any[];
}

export default function TransactionList({
  transactions,
}: TransactionListProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <p className="text-slate-400 text-center py-8">No transactions yet</p>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx,index) => (
        <TransactionItem key={index} tx={tx} />
      ))}
    </div>
  );
}
