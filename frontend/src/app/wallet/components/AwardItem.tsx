'use client';
import React from 'react';

interface AwardItemProps {
  award: {
    id: string;
    eventId: string;
    title: string;
    encAmount: number;
  };
  onClaim: (eventId: string) => void;
}

export default function AwardItem({ award, onClaim }: AwardItemProps) {
  return (
    <button
      onClick={() => onClaim(award.eventId)}
      className="w-full bg-slate-700 hover:bg-slate-600 p-3 rounded-xl text-left"
    >
      <div className="font-semibold">{award.title}</div>
      <div className="text-cyan-400">+${award.encAmount}</div>
    </button>
  );
}
