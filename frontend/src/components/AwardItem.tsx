'use client';
import { AwardsResponse } from '@/models';
import { RefreshCw } from 'lucide-react';
import React, { useState } from 'react';

interface AwardItemProps {
  award: AwardsResponse;
  onClaim: (eventId: string) => void;
}

export default function AwardItem({ award, onClaim }: AwardItemProps) {
  const [loader, setLoader] = useState(false);

  const onClaimWithLoader = async () => {
    setLoader(true);
    try {
      await onClaim(award.id.toString());
    } finally {
      setLoader(false);
    }
  };

  return (
    <>
      <button
        onClick={onClaimWithLoader}
        className={`w-full bg-slate-700 hover:bg-slate-600 p-3 rounded-xl text-left ${award.remaining === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={loader || award.remaining === 0}
      >
        <div className="font-semibold">{award.title}</div>
        <div className="text-cyan-400">+${award.encAmount}</div>
        {loader && <RefreshCw className="w-4 h-4 animate-spin" />}
      </button>
    </>
  );
}
