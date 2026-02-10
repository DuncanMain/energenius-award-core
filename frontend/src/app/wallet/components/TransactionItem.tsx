'use client';
import React from "react";

interface TransactionItemProps {
  tx: {
    txId: string;
    description: string;
    timestamp: string;
    type: "credit" | "debit";
    amount: number;
  };
}

export default function TransactionItem({ tx }: TransactionItemProps) {
  return (
    <div className="bg-slate-700 p-4 rounded-xl flex justify-between">
      <div>
        <div className="font-semibold">{tx.description}</div>
        <div className="text-xs text-slate-400">{new Date(tx.timestamp).toLocaleString()}</div>
      </div>
      <div className={`font-bold ${tx.type === "credit" ? "text-green-400" : "text-red-400"}`}>
        {tx.type === "credit" ? "+" : "-"}${tx.amount.toFixed(2)}
      </div>
    </div>
  );
}