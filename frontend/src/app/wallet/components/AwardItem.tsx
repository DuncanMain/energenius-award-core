"use client";
import { RefreshCw } from "lucide-react";
import React, { useState } from "react";

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
  const [loader, setLoader] = useState(false);

  const onClaimWithLoader = async ()=>{
    setLoader(true);
    try {
      await onClaim(award.id);
    } finally {
      setLoader(false);
    }
  }

  return (
    <>
      <button
        onClick={onClaimWithLoader}
        className={`w-full bg-slate-700 hover:bg-slate-600 p-3 rounded-xl text-left`}
        disabled={loader}
      >
        
        <div className="font-semibold">{award.title}</div>
        <div className="text-cyan-400">+${award.encAmount}</div>
        {loader && <RefreshCw className="w-4 h-4 animate-spin" />}
      </button>
    </>
  );
}
