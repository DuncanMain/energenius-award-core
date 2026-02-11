'use client';
import React from "react";
import AwardItem from "./AwardItem";

interface AwardListProps {
  awards: any[];    
  onClaim: (eventId: string) => void;
}

export default function AwardList({ awards, onClaim }: AwardListProps) {
  if (!awards || awards.length === 0) {
    return <p className="text-slate-400 text-center py-4">No rewards available</p>;
  }

  return (
    <div className="space-y-2">
      {awards.map((award) => (
        <AwardItem key={award.id} award={award} onClaim={onClaim} />
      ))}
    </div>
  );
}