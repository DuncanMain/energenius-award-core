export interface Award {
  id: string;
  name: string;
  description: string;
}

export interface AwardsResponse {
  id: string;
  eventId: string;
  rewardAmount: string; // no. enc coins
  maxCount: number;
  maxPerDay: number;
  todayCount: number;
  awardedCount: number;
  remaining: number;
  isAvailable: boolean;
}
