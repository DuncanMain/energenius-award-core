import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

// Valid event IDs
const VALID_EVENT_IDS = [
  'first_login',
  'community_post',
  'read_posts_5',
  'community_comment',
  'research_sustainable_living',
  'platform_feedback_quiz',
  'upload_energy_data',
  'upload_water_data',
  'upload_occupancy_data',
  'upload_heating_fuel_data',
  'friend_invite_success',
  'share_linkedin',
  'read_guide',
  'watch_video',
  'complete_quiz',
  'read_flexibility_topic',
  'read_water_impact',
  'read_renovation_topic',
  'read_support_options',
  'read_energy_opex_relation',
  'enplay_turn5_reached',
  'enplay_use_item',
  'enplay_purchase_res_item',
  'guru_interaction',
  'guru_energy_saving_advice',
  'guru_res_advice',
  'guru_renovation_advice',
  'guru_flexibility_advice',
  'guru_water_advice',
  'browse_res_items',
  'view_user_data',
  'view_energy_cost_forecast',
  'view_day_ahead_pricing',
  'view_comfort_health_data',
  'view_best_time_to_consume',
  'scan_property',
  'daily_login_bonus',
  'survival_mode_played',
];

// Valid sources
const VALID_SOURCES = [
  'enplay',
  'nexus',
  's2dt',
  'guru',
  'panorama',
  'market',
  'smartwatch',
  'community',
  'educationhub',
  'dashboard',
];

// Mock award amount mapping (default 10 for all events)
const getAwardAmount = (eventId: string): number => {
  // Default award amount for any event
  return 10;
};

// Mock awards data
const MOCK_AWARDS: Record<string, any> = {
  user123: {
    awardId: 'wlt_user123',
    uid: 'user123',
    address: '0xSAND_BOX_USER_123',
    balance: '110.00',
    awards: {
      first_login: 1,
      scan_qr: 2,
    },
    history: [
      {
        txId: 'tx_1003',
        type: 'credit',
        amount: '5.00',
        timestamp: '2025-11-07T11:00:00Z',
        eventId: 'scan_property',
      },
      {
        txId: 'tx_1002',
        type: 'credit',
        amount: '5.00',
        timestamp: '2025-11-07T10:30:00Z',
        eventId: 'scan_property',
      },
      {
        txId: 'tx_1001',
        type: 'credit',
        amount: '20.00',
        timestamp: '2025-11-07T09:00:00Z',
        eventId: 'first_login',
      },
    ],
    createdAt: '2025-11-07T10:00:00Z',
  },
};

// Transaction counter for generating unique txIds
let txCounter = 1004;

@Injectable()
export class AwardsService {
  async awardEvent(uid: string, eventId: string, source?: string) {
    // Validate eventId
    if (!VALID_EVENT_IDS.includes(eventId)) {
      throw new NotFoundException("unknown action");
    }

    // Validate source if provided
    if (source && !VALID_SOURCES.includes(source.toLowerCase())) {
      throw new NotFoundException("unknown source");
    }

    // Get or create awards
    if (!MOCK_AWARDS[uid]) {
      MOCK_AWARDS[uid] = {
        awardId: `wlt_${uid}`,
        uid,
        address: `0xSAND_BOX_${uid.toUpperCase()}`,
        balance: "0.00",
        awards: {},
        history: [],
        createdAt: new Date().toISOString(),
      };
    }

    const award = MOCK_AWARDS[uid];

    // Update balance
    const currentBalance = parseFloat(award.balance);
    const awardAmount = getAwardAmount(eventId);
    const newBalance = (currentBalance + awardAmount).toFixed(2);

    award.balance = newBalance;

    // Update awards count
    if (!award.awards[eventId]) {
      award.awards[eventId] = 0;
    }
    award.awards[eventId] += 1;

    // Add transaction to history
    const txId = `sandbox_tx_${txCounter++}`;
    const transaction = {
      txId,
      type: "credit",
      amount: awardAmount.toFixed(2),
      timestamp: new Date().toISOString(),
      eventId: eventId,
    };

    award.history.unshift(transaction); // Add to beginning (newest first)

    return {
      txHash: txId,
      newBalance,
    };
  }

  async spend(uid: string, amount: number, label?: string) {
    // Get awards
    if (!MOCK_AWARDS[uid]) {
      throw new ConflictException({ error: "UID does not exist" });
    }

    const award = MOCK_AWARDS[uid];
    const currentBalance = parseFloat(award.balance);

    // Check sufficient balance
    if (currentBalance < amount) {
      throw new ConflictException({ error: "INSUFFICIENT_BALANCE" });
    }

    // Update balance
    const newBalance = (currentBalance - amount).toFixed(2);
    award.balance = newBalance;

    // Add transaction to history
    const txId = `sandbox_tx_${txCounter++}`;
    const transaction = {
      txId,
      type: "debit",
      amount: amount.toFixed(2),
      timestamp: new Date().toISOString(),
      eventId: label || "spend",
    };

    award.history.unshift(transaction); // Add to beginning (newest first)

    return {
      txHash: txId,
      newBalance,
    };
  }

  async getUserAwards(uid: string) {
    // Get awards
    if (!MOCK_AWARDS[uid]) {
      throw new ConflictException({ error: "UID does not exist" });
    }

    const award = MOCK_AWARDS[uid];

    // Return last 10 transactions
    const last10History = award.history.slice(0, 10);

    return {
      address: award.address,
      balance: award.balance,
      history: last10History,
    };
  }

  async getAvailableRewards(uid: string) {
    // Return static available rewards list with new eventId format
    return {
      availableRewards: [
        {
          eventId: "guru_renovation_advice",
          source: "Guru",
          value: "Medium",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "read_posts_5",
          source: "Community",
          value: "Medium",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "watch_video",
          source: "Education Hub",
          value: "Medium",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "scan_property",
          source: "S2DT",
          value: "High",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "upload_water_data",
          source: "Dashboard",
          value: "Medium",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "enplay_use_item",
          source: "ENPlay",
          value: "Low",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "view_user_data",
          source: "Panorama",
          value: "Low",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "research_sustainable_living",
          source: "Community",
          value: "Low",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "read_renovation_topic",
          source: "Education Hub",
          value: "Low",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
        {
          eventId: "upload_heating_fuel_data",
          source: "Dashboard",
          value: "Medium",
          reward: null,
          maxPerUser: null,
          maxPerDay: null,
        },
      ],
    };
  }

  async getAwards() {
    // Return static award rules list with new format
    return [
      {
        eventId: "first_login",
        source: "Nexus",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "community_post",
        source: "Community",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "read_posts_5",
        source: "Community",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "community_comment",
        source: "Community",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "research_sustainable_living",
        source: "Community",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "platform_feedback_quiz",
        source: "Community",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "upload_energy_data",
        source: "Dashboard",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "upload_water_data",
        source: "Dashboard",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "upload_occupancy_data",
        source: "Dashboard",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "upload_heating_fuel_data",
        source: "Dashboard",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "friend_invite_success",
        source: "Dashboard",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "share_linkedin",
        source: "Dashboard",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "read_guide",
        source: "Education Hub",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "watch_video",
        source: "Education Hub",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "complete_quiz",
        source: "Education Hub",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "read_flexibility_topic",
        source: "Education Hub",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "read_water_impact",
        source: "Education Hub",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "read_renovation_topic",
        source: "Education Hub",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "read_support_options",
        source: "Education Hub",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "read_energy_opex_relation",
        source: "Education Hub",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "enplay_turn5_reached",
        source: "ENPlay",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "enplay_use_item",
        source: "ENPlay",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "enplay_purchase_res_item",
        source: "ENPlay",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "guru_interaction",
        source: "Guru",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "guru_energy_saving_advice",
        source: "Guru",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "guru_res_advice",
        source: "Guru",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "guru_renovation_advice",
        source: "Guru",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "guru_flexibility_advice",
        source: "Guru",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "guru_water_advice",
        source: "Guru",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "browse_res_items",
        source: "Market",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "view_user_data",
        source: "Panorama",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "view_energy_cost_forecast",
        source: "Panorama",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "view_day_ahead_pricing",
        source: "Panorama",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "view_comfort_health_data",
        source: "Panorama",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "view_best_time_to_consume",
        source: "Panorama",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "scan_property",
        source: "S2DT",
        value: "High",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "daily_login_bonus",
        source: "ENPlay",
        value: "Low",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
      {
        eventId: "survival_mode_played",
        source: "ENPlay",
        value: "Medium",
        reward: null,
        maxPerUser: null,
        maxPerDay: null,
      },
    ];
  }
}

