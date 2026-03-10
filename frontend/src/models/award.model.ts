export interface Award {
  id: string;
  name: string;
  description: string;
}

export interface AwardsResponse {
  id: string;
  event_id: string;
  reward_amount: string;
  max_count: number;
  max_per_day: number;
  today_count: number;
  awarded_count: number;
  remaining: number;
  is_available: boolean;
}
