export interface Award {
  id: string;
  name: string;
  description: string;
}

export interface AwardsResponse {
  id: string;
  title: string;
  encAmount: string;
  maxCount: number;
  awardedCount: number;
  remaining: number;
  isAvailable: boolean;
}
