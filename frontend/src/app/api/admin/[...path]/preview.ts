const permissions = [
  'ADMIN_DASHBOARD_VIEW',
  'ADMIN_WALLET_READ',
  'ADMIN_TRANSACTION_READ',
  'ADMIN_TRANSACTION_RECONCILE',
  'ADMIN_AWARD_RULE_READ',
  'ADMIN_AWARD_RULE_CREATE',
  'ADMIN_AWARD_RULE_UPDATE',
  'ADMIN_AWARD_RULE_DISABLE',
  'ADMIN_TOKEN_RULE_MANAGE',
  'ADMIN_BALANCE_ADJUST',
  'ADMIN_TREASURY_READ',
  'ADMIN_CONTRACT_PAUSE',
  'ADMIN_CONTRACT_UNPAUSE',
  'ADMIN_SYSTEM_HEALTH_READ',
  'ADMIN_AUDIT_READ',
  'ADMIN_ACCESS_MANAGE',
];
const now = new Date().toISOString();
const users = [
  {
    id: 1,
    uidNew: 'nexus-user-b5271d',
    uid: 'legacy-582',
    address: '0x26f7C22fAF19846151d8c42a6AE10493E841d53b',
    updatedAt: now,
  },
  {
    id: 2,
    uidNew: 'nexus-user-41f209',
    uid: null,
    address: '0x78CE5a8827D329ce8A35F17b5dDD4E6716aa0142',
    updatedAt: now,
  },
  {
    id: 3,
    uidNew: 'nexus-user-90ac11',
    uid: 'legacy-188',
    address: '0x921C207f30cF92DA48f5bEA47643EA25D0b04E8D',
    updatedAt: now,
  },
];
const events = [
  {
    id: 'ev1',
    eventId: 'first_login',
    displayName: 'First Nexus login',
    source: 'Nexus',
    relativeValue: 1,
    rewardAmount: 1,
    maxPerUser: 1,
    maxPerDay: 0,
    enabled: true,
    globalCapExempt: false,
  },
  {
    id: 'ev2',
    eventId: 'enplay_purchase_res_item',
    displayName: 'Purchase research item',
    source: 'ENPlay',
    relativeValue: 2,
    rewardAmount: 3,
    maxPerUser: 0,
    maxPerDay: 2,
    enabled: true,
    globalCapExempt: false,
  },
  {
    id: 'ev3',
    eventId: 'scan_property',
    displayName: 'Scan a property',
    source: 'Data Beacon',
    relativeValue: 3,
    rewardAmount: 5,
    maxPerUser: 0,
    maxPerDay: 0,
    enabled: true,
    globalCapExempt: true,
  },
  {
    id: 'ev4',
    eventId: 'community_referral',
    displayName: 'Community referral',
    source: 'Nexus',
    relativeValue: 2,
    rewardAmount: 2,
    maxPerUser: 5,
    maxPerDay: 1,
    enabled: false,
    globalCapExempt: false,
  },
];

export function previewResponse(path: string, method: string) {
  if (method !== 'GET')
    return { ok: true, status: 'PREVIEW_ONLY', message: 'No data was changed' };
  if (path === 'me')
    return {
      nexusSubject: 'preview-admin-7f31',
      displayName: 'Duncan · UI Preview',
      enabled: true,
      permissions,
    };
  if (path === 'overview')
    return {
      confirmedAwardAmount: 18420,
      confirmedAwardCount: 6392,
      confirmedSpendAmount: 7310,
      confirmedSpendCount: 1448,
      operations: { RESERVED: 2, SUBMITTED: 3, RECONCILIATION_REQUIRED: 1 },
      rejected: [
        {
          id: 'r1',
          createdAt: now,
          eventId: 'enplay_purchase_res_item',
          targetUserId: 'usr_92c…f1',
          reasonCategory: 'DAILY_CAP',
        },
        {
          id: 'r2',
          createdAt: now,
          eventId: 'mobility_trip_complete',
          targetUserId: 'usr_40a…19',
          reasonCategory: 'UNKNOWN_EVENT',
        },
      ],
      recentAudit: [
        {
          id: 'a1',
          createdAt: now,
          actorNexusSubject: 'nexus-admin-7f31',
          action: 'AWARD_RULE_UPDATED',
          resourceType: 'AwardRule',
        },
        {
          id: 'a2',
          createdAt: now,
          actorNexusSubject: 'nexus-admin-a048',
          action: 'RECONCILIATION_RUN',
          resourceType: 'chain',
        },
      ],
    };
  if (path.startsWith('users/'))
    return {
      nexusUserId: users[0].uidNew,
      balanceWei: '124000000000000000000',
      wallet: users[0],
      history: [
        {
          id: 1,
          createdAt: now,
          type: 'award',
          amount: '3',
          status: 'CONFIRMED',
          txHash: '0x8ff4b10fa3a49c929bac91d4',
        },
        {
          id: 2,
          createdAt: now,
          type: 'spend',
          amount: '1',
          status: 'CONFIRMED',
          txHash: '0x13c78b82e70a4ceee20203ac',
        },
      ],
    };
  if (path.startsWith('users')) return { total: users.length, items: users };
  if (path.startsWith('transactions'))
    return {
      total: 3,
      items: [
        {
          id: 'op1',
          createdAt: now,
          type: 'AWARD',
          uid: users[0].uidNew,
          amount: '3',
          status: 'CONFIRMED',
          txHash: '0x8ff4b10fa3a49c929bac91d4',
          componentIdentity: 'enplay-api',
        },
        {
          id: 'op2',
          createdAt: now,
          type: 'SPEND',
          uid: users[1].uidNew,
          amount: '2',
          status: 'SUBMITTED',
          txHash: '0x229a6a68b09bd9b894119b33',
          componentIdentity: 'marketplace-api',
        },
        {
          id: 'op3',
          createdAt: now,
          type: 'ADJUSTMENT_CREDIT',
          uid: users[2].uidNew,
          amount: '5',
          status: 'RECONCILIATION_REQUIRED',
          txHash: '0x013fe9f07f1b579835b2b46d',
          componentIdentity: null,
        },
      ],
    };
  if (path.startsWith('reward-events'))
    return { total: events.length, items: events };
  if (path === 'token-rules')
    return {
      capEnabled: true,
      dailyCap: 5,
      resetBasis: 'UTC_DAY',
      exemptions: [
        { eventId: 'scan_property', displayName: 'Scan a property' },
      ],
    };
  if (path === 'component-sources')
    return {
      policy: { identityClaim: 'azp', enforce: false },
      observations: [
        {
          id: 'o1',
          createdAt: now,
          componentIdentity: 'enplay-api',
          configuredSource: 'ENPlay',
          eventId: 'enplay_purchase_res_item',
          matched: true,
        },
        {
          id: 'o2',
          createdAt: now,
          componentIdentity: 'unknown-component',
          configuredSource: 'Data Beacon',
          eventId: 'scan_property',
          matched: false,
        },
      ],
    };
  if (path.startsWith('administrators'))
    return {
      total: 2,
      items: [
        {
          id: 'ad1',
          displayName: 'Duncan',
          nexusSubject: 'nexus-admin-7f31',
          enabled: true,
          permissions,
        },
        {
          id: 'ad2',
          displayName: 'Operations reviewer',
          nexusSubject: 'nexus-admin-a048',
          enabled: true,
          permissions: permissions.slice(0, 7),
        },
      ],
    };
  if (path.startsWith('audit'))
    return {
      total: 3,
      items: [
        {
          id: 'au1',
          createdAt: now,
          actorNexusSubject: 'nexus-admin-7f31',
          action: 'TOKEN_POLICY_UPDATED',
          resourceType: 'TokenPolicy',
          reason: 'Approved cap change',
        },
        {
          id: 'au2',
          createdAt: now,
          actorNexusSubject: 'nexus-admin-a048',
          action: 'AWARD_RULE_UPDATED',
          resourceType: 'AwardRule',
          reason: 'Campaign ended',
        },
        {
          id: 'au3',
          createdAt: now,
          actorNexusSubject: 'nexus-admin-7f31',
          action: 'BALANCE_ADJUSTMENT_CONFIRMED',
          resourceType: 'TxLog',
          reason: 'Customer support correction',
        },
      ],
    };
  if (path === 'system/health')
    return {
      chain_id: 80002,
      contract_address: '0xA648F8fC2c23A7010C23C174DAa20Bcc947F74D8',
      contract_deployed: true,
      signer_address: '0x0123D96bc9115e02D115FbC63fc6586FE271A843',
      owner_address: '0x0123D96bc9115e02D115FbC63fc6586FE271A843',
      signer_is_owner: true,
      treasury_address: '0x65Ccb84fDD2E31B14a5BB09276b01Ca87031206d',
      treasury_balance_wei: '825000000000000000000000',
      paused: false,
      token: { name: 'ENERGENIUS Coin', symbol: 'ENC' },
      latest_block: 17828431,
      last_reconciled_block: '17828426',
    };
  return { items: [], total: 0 };
}
