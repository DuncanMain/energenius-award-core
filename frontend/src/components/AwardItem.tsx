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
  const isAvailableMore = ()=>{
    return award.max_per_day === award.today_count;
  }
  return (
    <>
      <button
        onClick={onClaimWithLoader}
        className={`w-full bg-slate-700 hover:bg-slate-600 p-3 rounded-xl text-left ${isAvailableMore() ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={loader || isAvailableMore()}
      >
        <div className="font-semibold">{award.event_id}</div>
        <div className="text-cyan-400">+${award.reward_amount}</div>
        <div className="text-cyan-400">{award.is_available ? 'Available' : 'Not Available'}</div>
        <div className="text-cyan-400">Remaining: {award.remaining ?? '0'}</div>
        {loader && <RefreshCw className="w-4 h-4 animate-spin" />}
      </button>
    </>
  );
}
