'use client';
import { AwardsResponse } from '@/models';
import { formatEventName } from '@/utils/formatEventName';
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
  const isUnavailable = () => {
    return !award.is_available;
  };
  return (
    <>
      <button
        onClick={onClaimWithLoader}
        className={`w-full bg-slate-700 hover:bg-slate-600 p-3 rounded-xl text-left ${isUnavailable() ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={loader || isUnavailable()}
      >
        <div className="font-semibold">{formatEventName(award.event_id)}</div>{' '}
        <div className="text-cyan-400">+{award.reward_amount} ENC</div>
        <div className="text-cyan-400">
          {award.is_available ? 'Available' : 'Not Available'}
        </div>
        <div className="text-cyan-400">
          Remaining: {award.remaining === null ? 'Unlimited' : award.remaining}
        </div>
        <div className="text-cyan-400">
          Max per day:{' '}
          {award.max_per_day === 0 ? 'Unlimited' : award.max_per_day}
        </div>
        {loader && <RefreshCw className="w-4 h-4 animate-spin" />}
      </button>
    </>
  );
}
