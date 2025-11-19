import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

// Mock award rules data
const MOCK_AWARD_RULES = [
  {
    id: 'AS-1',
    title: 'First Login',
    encAmount: 20,
    maxCount: 1,
    eventId: 'first_login',
  },
  {
    id: 'AS-2',
    title: 'Scan QR',
    encAmount: 5,
    maxCount: null,
    eventId: 'scan_qr',
  },
];

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
        description: 'scan_qr',
      },
      {
        txId: 'tx_1002',
        type: 'credit',
        amount: '5.00',
        timestamp: '2025-11-07T10:30:00Z',
        description: 'scan_qr',
      },
      {
        txId: 'tx_1001',
        type: 'credit',
        amount: '20.00',
        timestamp: '2025-11-07T09:00:00Z',
        description: 'first_login',
      },
    ],
    createdAt: '2025-11-07T10:00:00Z',
  },
};

// Transaction counter for generating unique txIds
let txCounter = 1004;

@Injectable()
export class AwardsService {
  async awardEvent(uid: string, eventId: string) {
    // Validate eventId exists in award rules
    const rule = MOCK_AWARD_RULES.find((r) => r.eventId === eventId);
    if (!rule) {
      throw new NotFoundException('unknown action');
    }

    // Get or create awards
    if (!MOCK_AWARDS[uid]) {
      MOCK_AWARDS[uid] = {
        awardId: `wlt_${uid}`,
        uid,
        address: `0xSAND_BOX_${uid.toUpperCase()}`,
        balance: '0.00',
        awards: {},
        history: [],
        createdAt: new Date().toISOString(),
      };
    }

    const award = MOCK_AWARDS[uid];

    // Update balance
    const currentBalance = parseFloat(award.balance);
    const awardAmount = rule.encAmount;
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
      type: 'credit',
      amount: awardAmount.toFixed(2),
      timestamp: new Date().toISOString(),
      description: eventId,
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
      throw new ConflictException({ error: 'UID does not exist' });
    }

    const award = MOCK_AWARDS[uid];
    const currentBalance = parseFloat(award.balance);

    // Check sufficient balance
    if (currentBalance < amount) {
      throw new ConflictException({ error: 'INSUFFICIENT_BALANCE' });
    }

    // Update balance
    const newBalance = (currentBalance - amount).toFixed(2);
    award.balance = newBalance;

    // Add transaction to history
    const txId = `sandbox_tx_${txCounter++}`;
    const transaction = {
      txId,
      type: 'debit',
      amount: amount.toFixed(2),
      timestamp: new Date().toISOString(),
      description: label || 'spend',
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
      throw new ConflictException({ error: 'UID does not exist' });
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

  async getAwards() {
    // Return static award rules
    return MOCK_AWARD_RULES.map((rule) => ({
      id: rule.id,
      title: rule.title,
      encAmount: rule.encAmount,
      maxCount: rule.maxCount,
    }));
  }
}

