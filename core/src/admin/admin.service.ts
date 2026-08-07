import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminPermissionEnum,
  ChainOperationType,
  Prisma,
} from '@prisma/client';
import { formatUnits, parseUnits } from 'ethers';
import { PrismaService } from '@/prisma/prisma.service';
import { ChainService } from '@/chain/chain.service';
import {
  AdjustmentDto,
  CreateAdminDto,
  CreateAwardRuleDto,
  CreateComponentSourceMappingDto,
  PageQueryDto,
  UpdateAdminDto,
  UpdateAwardRuleDto,
  UpdateTokenPolicyDto,
  UpdateComponentSourceMappingDto,
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService
  ) {}

  private page(query: PageQueryDto) {
    return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
  }

  private serialize<T>(value: T): T {
    return JSON.parse(
      JSON.stringify(value, (_, item) =>
        typeof item === 'bigint' ? item.toString() : item
      )
    );
  }

  async overview() {
    const [
      award,
      spend,
      operationGroups,
      rejected,
      audit,
      latestAward,
      latestSpend,
      cursor,
    ] = await Promise.all([
      this.prisma.txLog.aggregate({
        where: { type: 'award', status: 'CONFIRMED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.txLog.aggregate({
        where: { type: 'spend', status: 'CONFIRMED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.chainOperation.groupBy({ by: ['status'], _count: true }),
      this.prisma.rejectedAwardRequest.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminAuditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.txLog.findFirst({
        where: { type: 'award', status: 'CONFIRMED' },
        orderBy: { confirmedAt: 'desc' },
      }),
      this.prisma.txLog.findFirst({
        where: { type: 'spend', status: 'CONFIRMED' },
        orderBy: { confirmedAt: 'desc' },
      }),
      this.prisma.chainSyncCursor.findUnique({
        where: { chainId: this.chain.getChainId() },
      }),
    ]);
    return this.serialize({
      confirmedAwardAmount: award._sum.amount ?? 0,
      confirmedAwardCount: award._count,
      confirmedSpendAmount: spend._sum.amount ?? 0,
      confirmedSpendCount: spend._count,
      operations: Object.fromEntries(
        operationGroups.map(item => [item.status, item._count])
      ),
      rejected,
      recentAudit: audit,
      latestAwardAt: latestAward?.confirmedAt ?? latestAward?.createdAt ?? null,
      latestSpendAt: latestSpend?.confirmedAt ?? latestSpend?.createdAt ?? null,
      cursor,
    });
  }

  async users(query: PageQueryDto) {
    const search = query.search?.trim();
    const txUid = search
      ? await this.prisma.txLog.findFirst({
          where: { txHash: { equals: search, mode: 'insensitive' } },
          select: { uid: true, uidNew: true },
        })
      : null;
    const where: Prisma.UserWalletWhereInput = search
      ? {
          OR: [
            { uid: { contains: search, mode: 'insensitive' } },
            { uidNew: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            ...(txUid?.uid ? [{ uid: txUid.uid }] : []),
            ...(txUid?.uidNew ? [{ uidNew: txUid.uidNew }] : []),
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.userWallet.findMany({
        where,
        ...this.page(query),
        orderBy: { updatedAt: query.order },
      }),
      this.prisma.userWallet.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      emailSearchAvailable: false,
    };
  }

  async userDetail(identifier: string) {
    const wallet = await this.prisma.userWallet.findFirst({
      where: {
        OR: [
          { uid: identifier },
          { uidNew: identifier },
          { address: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const uidValues = [wallet.uid, wallet.uidNew].filter(Boolean) as string[];
    const [balance, history, operations] = await Promise.all([
      this.chain.balanceOf(wallet.address),
      this.prisma.txLog.findMany({
        where: {
          OR: [{ uid: { in: uidValues } }, { uidNew: { in: uidValues } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.chainOperation.findMany({
        where: { uid: { in: uidValues } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return this.serialize({
      wallet,
      nexusUserId: wallet.uidNew ?? wallet.uid,
      email: null,
      emailSearchAvailable: false,
      balanceWei: balance.toString(),
      history,
      operations,
    });
  }

  async transactions(query: PageQueryDto) {
    // The transactions view unifies the two stores that together hold the full picture:
    //  • tx_log           — the confirmed transaction ledger (all history + every new award/spend)
    //  • chain_operations — durable operations with lifecycle/reconciliation state
    // A confirmed operation exists in BOTH (tx_log.chainOperationId links them), so we list every
    // tx_log row PLUS only the chain_operations that have not yet produced a tx_log (in-flight /
    // failed / reconciliation-required). Deduped — no double-counting. Overview stats are unchanged
    // (they still read tx_log only).
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const createdAt =
      from || to
        ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
        : undefined;
    const search = query.search;

    const txWhere: Prisma.TxLogWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.source
        ? { source: { contains: query.source, mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { uid: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { txHash: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const opWhere: Prisma.ChainOperationWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.type ? { type: query.type as any } : {}),
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.source
        ? { source: { contains: query.source, mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { uid: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { txHash: { contains: search, mode: 'insensitive' } },
              {
                componentIdentity: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    // Exclude chain_operations already represented in tx_log (any status) to avoid duplicates.
    const linked = await this.prisma.txLog.findMany({
      where: { chainOperationId: { not: null } },
      select: { chainOperationId: true },
    });
    const excludeOpIds = linked
      .map(l => l.chainOperationId)
      .filter((id): id is string => Boolean(id));

    const [txRows, opRows] = await Promise.all([
      this.prisma.txLog.findMany({ where: txWhere }),
      this.prisma.chainOperation.findMany({
        where: excludeOpIds.length
          ? { AND: [opWhere, { id: { notIn: excludeOpIds } }] }
          : opWhere,
      }),
    ]);

    const unified = [
      ...txRows.map(r => ({
        origin: 'tx_log' as const,
        id: String(r.id),
        createdAt: r.createdAt,
        type: r.type,
        uid: r.uid,
        address: r.address,
        amount: r.amount,
        status: r.status,
        txHash: r.txHash,
        eventId: r.eventId,
        source: r.source,
        label: r.label,
        chainId: r.chainId,
        confirmedAt: r.confirmedAt,
        reason: r.reason,
        adminSubject: r.adminSubject,
        componentIdentity: null as string | null,
      })),
      ...opRows.map(r => ({
        origin: 'chain_operation' as const,
        id: r.id,
        createdAt: r.createdAt,
        type: r.type,
        uid: r.uid,
        address: r.address,
        amount: r.amount,
        status: r.status,
        txHash: r.txHash,
        eventId: r.eventId,
        source: r.source,
        label: r.label,
        chainId: r.chainId,
        confirmedAt: r.confirmedAt,
        reason: r.reason,
        adminSubject: r.adminSubject,
        componentIdentity: r.componentIdentity,
      })),
    ];

    const sortField = ['createdAt', 'amount', 'status'].includes(query.sort)
      ? query.sort
      : 'createdAt';
    const dir = query.order === 'asc' ? 1 : -1;
    unified.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') {
        cmp = Number(a.amount) - Number(b.amount);
      } else if (sortField === 'status') {
        cmp = String(a.status).localeCompare(String(b.status));
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return cmp * dir;
    });

    const total = unified.length;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    const items = unified.slice(start, start + pageSize);

    return this.serialize({ items, total, page, pageSize });
  }

  async rules(query: PageQueryDto) {
    const where: Prisma.AwardRuleWhereInput = query.search
      ? {
          OR: [
            { eventId: { contains: query.search, mode: 'insensitive' } },
            { displayName: { contains: query.search, mode: 'insensitive' } },
            { source: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.awardRule.findMany({
        where,
        ...this.page(query),
        orderBy: { eventId: query.order },
      }),
      this.prisma.awardRule.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async rule(id: string) {
    const rule = await this.prisma.awardRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rewardable event not found');
    const history = await this.prisma.adminAuditLog.findMany({
      where: { resourceType: 'AwardRule', resourceId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { rule, history };
  }

  async createRule(dto: CreateAwardRuleDto, subject: string) {
    if (
      await this.prisma.awardRule.findFirst({ where: { eventId: dto.eventId } })
    )
      throw new ConflictException('eventId already exists');
    const rule = await this.prisma.awardRule.create({
      data: { ...dto, createdBy: subject, updatedBy: subject },
    });
    await this.audit(
      subject,
      'AWARD_RULE_CREATED',
      'AwardRule',
      rule.id,
      null,
      rule
    );
    return rule;
  }

  async updateRule(id: string, dto: UpdateAwardRuleDto, subject: string) {
    const before = await this.prisma.awardRule.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Rewardable event not found');
    if (dto.eventId && dto.eventId !== before.eventId) {
      const used = await this.prisma.$transaction(
        async tx =>
          (await tx.txLog.count({ where: { eventId: before.eventId } })) +
          (await tx.chainOperation.count({
            where: { eventId: before.eventId },
          })) +
          (await tx.userAward.count({ where: { awardRuleId: id } }))
      );
      if (used > 0)
        throw new ConflictException(
          'eventId is immutable after use; retire this event and create another'
        );
      if (
        await this.prisma.awardRule.findFirst({
          where: { eventId: dto.eventId, NOT: { id } },
        })
      )
        throw new ConflictException('eventId already exists');
    }
    const { reason, retired, ...data } = dto;
    const after = await this.prisma.awardRule.update({
      where: { id },
      data: {
        ...data,
        ...(retired === undefined
          ? {}
          : {
              retiredAt: retired ? new Date() : null,
              enabled: retired ? false : data.enabled,
            }),
        updatedBy: subject,
      },
    });
    await this.audit(
      subject,
      retired ? 'AWARD_RULE_RETIRED' : 'AWARD_RULE_UPDATED',
      'AwardRule',
      id,
      before,
      after,
      reason,
      undefined,
      after.eventId
    );
    return after;
  }

  async tokenPolicy() {
    const policy = await this.prisma.tokenPolicy.upsert({
      where: { id: 'global' },
      update: {},
      create: {
        id: 'global',
        capEnabled: true,
        dailyCap: 5,
        resetBasis: 'UTC_DAY',
      },
    });
    const exemptions = await this.prisma.awardRule.findMany({
      where: { globalCapExempt: true },
      select: { id: true, eventId: true, displayName: true },
    });
    const history = await this.prisma.adminAuditLog.findMany({
      where: { resourceType: 'TokenPolicy' },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    return { ...policy, exemptions, history };
  }

  async updateTokenPolicy(dto: UpdateTokenPolicyDto, subject: string) {
    const before = await this.tokenPolicy();
    const after = await this.prisma.$transaction(async tx => {
      await tx.awardRule.updateMany({ data: { globalCapExempt: false } });
      await tx.awardRule.updateMany({
        where: { eventId: { in: dto.exemptions } },
        data: { globalCapExempt: true, updatedBy: subject },
      });
      return tx.tokenPolicy.upsert({
        where: { id: 'global' },
        update: {
          capEnabled: dto.capEnabled,
          dailyCap: dto.dailyCap,
          updatedBy: subject,
        },
        create: {
          id: 'global',
          capEnabled: dto.capEnabled,
          dailyCap: dto.dailyCap,
          updatedBy: subject,
        },
      });
    });
    await this.audit(
      subject,
      'TOKEN_POLICY_UPDATED',
      'TokenPolicy',
      'global',
      before,
      { ...after, exemptions: dto.exemptions },
      dto.reason
    );
    return this.tokenPolicy();
  }

  async componentSources() {
    const [policy, mappings, observations] = await Promise.all([
      this.prisma.componentSourcePolicy.upsert({
        where: { id: 'global' },
        update: {},
        create: { id: 'global', identityClaim: 'azp', enforce: false },
      }),
      this.prisma.componentSourceMapping.findMany({
        orderBy: [{ componentIdentity: 'asc' }, { source: 'asc' }],
      }),
      this.prisma.componentSourceObservation.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { policy, mappings, observations };
  }

  async createComponentSource(
    dto: CreateComponentSourceMappingDto,
    subject: string
  ) {
    const mapping = await this.prisma.componentSourceMapping.upsert({
      where: {
        componentIdentity_source: {
          componentIdentity: dto.componentIdentity,
          source: dto.source,
        },
      },
      update: { enabled: true },
      create: { ...dto, createdBy: subject },
    });
    await this.audit(
      subject,
      'COMPONENT_SOURCE_MAPPING_SAVED',
      'ComponentSourceMapping',
      mapping.id,
      null,
      mapping
    );
    return mapping;
  }

  async updateComponentSource(
    id: string,
    dto: UpdateComponentSourceMappingDto,
    subject: string
  ) {
    const before = await this.prisma.componentSourceMapping.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Component mapping not found');
    const after = await this.prisma.componentSourceMapping.update({
      where: { id },
      data: { enabled: dto.enabled },
    });
    await this.audit(
      subject,
      'COMPONENT_SOURCE_MAPPING_UPDATED',
      'ComponentSourceMapping',
      id,
      before,
      after,
      dto.reason
    );
    return after;
  }

  async admins(query: PageQueryDto) {
    const where: Prisma.AdminPrincipalWhereInput = query.search
      ? {
          OR: [
            { nexusSubject: { contains: query.search, mode: 'insensitive' } },
            { displayName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.adminPrincipal.findMany({
        where,
        ...this.page(query),
        orderBy: { createdAt: query.order },
      }),
      this.prisma.adminPrincipal.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createAdmin(dto: CreateAdminDto, subject: string) {
    const invalid = dto.permissions.filter(
      permission => !Object.values(AdminPermissionEnum).includes(permission)
    );
    if (invalid.length)
      throw new BadRequestException('Invalid admin permission');
    try {
      const admin = await this.prisma.adminPrincipal.create({ data: dto });
      await this.audit(
        subject,
        'ADMIN_CREATED',
        'AdminPrincipal',
        admin.id,
        null,
        admin
      );
      return admin;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Nexus subject is already an administrator'
        );
      throw error;
    }
  }

  async updateAdmin(id: string, dto: UpdateAdminDto, subject: string) {
    const before = await this.prisma.adminPrincipal.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Administrator not found');
    const permissions = dto.permissions ?? before.permissions;
    const removesAccess = !permissions.includes(
      AdminPermissionEnum.ADMIN_ACCESS_MANAGE
    );
    const disables = dto.enabled === false;
    if (
      (removesAccess || disables) &&
      before.permissions.includes(AdminPermissionEnum.ADMIN_ACCESS_MANAGE)
    ) {
      const capable = await this.prisma.adminPrincipal.count({
        where: {
          enabled: true,
          permissions: { has: AdminPermissionEnum.ADMIN_ACCESS_MANAGE },
          NOT: { id },
        },
      });
      if (capable === 0)
        throw new ConflictException(
          'Cannot remove the last enabled access administrator'
        );
      if (before.nexusSubject === subject && removesAccess)
        throw new ConflictException(
          'Cannot remove your own access-management permission'
        );
    }
    const after = await this.prisma.adminPrincipal.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        enabled: dto.enabled,
        permissions: dto.permissions,
      },
    });
    await this.audit(
      subject,
      'ADMIN_UPDATED',
      'AdminPrincipal',
      id,
      before,
      after,
      dto.reason
    );
    return after;
  }

  async auditLogs(query: PageQueryDto) {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.search
        ? {
            OR: [
              {
                actorNexusSubject: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { action: { contains: query.search, mode: 'insensitive' } },
              { resourceType: { contains: query.search, mode: 'insensitive' } },
              { userUid: { contains: query.search, mode: 'insensitive' } },
              { eventId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        ...this.page(query),
        orderBy: { createdAt: query.order },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async adjust(dto: AdjustmentDto, subject: string) {
    if (dto.confirmation !== `CONFIRM ${dto.type} ${dto.amount} ENC`)
      throw new BadRequestException('Typed confirmation does not match');
    const existing = await this.prisma.chainOperation.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return this.serialize(existing);
    const wallet = await this.prisma.userWallet.findFirst({
      where: { OR: [{ uid: dto.uid }, { uidNew: dto.uid }] },
    });
    if (!wallet) throw new NotFoundException('User wallet not found');
    if (
      dto.originalTxLogId &&
      !(await this.prisma.txLog.findUnique({
        where: { id: dto.originalTxLogId },
      }))
    )
      throw new NotFoundException('Original transaction not found');
    const credit = ['CREDIT', 'CORRECTION_CREDIT', 'REFUND'].includes(dto.type);
    const operationType: ChainOperationType =
      dto.type === 'CREDIT'
        ? 'ADJUSTMENT_CREDIT'
        : dto.type === 'DEBIT'
          ? 'ADJUSTMENT_DEBIT'
          : (dto.type as ChainOperationType);
    const amountWei = parseUnits(String(dto.amount), 18);
    const [userBalance, treasury] = await Promise.all([
      this.chain.balanceOf(wallet.address),
      this.chain.treasury(),
    ]);
    const treasuryBalance = credit ? await this.chain.balanceOf(treasury) : 0n;
    if (credit && treasuryBalance < amountWei)
      throw new BadRequestException('Treasury has insufficient ENC');
    let operation;
    try {
      operation = await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'energenius-admin-adjust:' + (wallet.uidNew ?? wallet.uid)}))`;
        if (!credit) {
          const pending = await tx.chainOperation.aggregate({
            where: {
              uid: wallet.uidNew ?? wallet.uid!,
              type: { in: ['SPEND', 'ADJUSTMENT_DEBIT', 'CORRECTION_DEBIT'] },
              status: {
                in: ['RESERVED', 'SUBMITTED', 'RECONCILIATION_REQUIRED'],
              },
            },
            _sum: { amount: true },
          });
          const required = parseUnits(
            String(Number(pending._sum.amount ?? 0) + dto.amount),
            18
          );
          if (userBalance < required)
            throw new BadRequestException(
              `Insufficient balance: ${formatUnits(userBalance, 18)} ENC`
            );
        }
        return tx.chainOperation.create({
          data: {
            uid: wallet.uidNew ?? wallet.uid!,
            address: wallet.address,
            type: operationType,
            amount: String(dto.amount),
            chainId: this.chain.getChainId(),
            label: dto.type,
            idempotencyKey: dto.idempotencyKey,
            adminSubject: subject,
            reason: dto.reason,
            internalReference: dto.internalReference,
            originalTxLogId: dto.originalTxLogId,
          },
        });
      });
    } catch (error) {
      // A concurrent request with the same idempotency key won the create race — return that
      // operation instead of surfacing an opaque unique-constraint 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingOp = await this.prisma.chainOperation.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existingOp) return this.serialize(existingOp);
      }
      throw error;
    }
    let txHash: string | null = null;
    try {
      txHash = await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('energenius-treasury-signer'))`;
        const submitted = credit
          ? await this.chain.submitAward(wallet.address, amountWei)
          : await this.chain.submitSpend(wallet.address, amountWei);
        await tx.chainOperation.update({
          where: { id: operation.id },
          data: {
            status: 'SUBMITTED',
            txHash: submitted.hash,
            submittedAt: new Date(),
          },
        });
        return submitted.hash;
      });
      const receipt = await this.chain.waitForTransaction(txHash);
      const contractLog = receipt.logs.find(
        log =>
          log.address.toLowerCase() ===
          this.chain.getContractAddress().toLowerCase()
      );
      const txLog = await this.prisma.$transaction(async tx => {
        const log = await tx.txLog.create({
          data: {
            uid: wallet.uid,
            uidNew: wallet.uidNew,
            address: wallet.address,
            type: dto.type.toLowerCase(),
            label: dto.type,
            amount: String(dto.amount),
            txHash: txHash!,
            chainId: this.chain.getChainId(),
            status: 'CONFIRMED',
            blockNumber: BigInt(receipt.blockNumber),
            blockHash: receipt.blockHash,
            logIndex: contractLog?.index,
            confirmedAt: new Date(),
            chainOperationId: operation.id,
            adminSubject: subject,
            reason: dto.reason,
            internalReference: dto.internalReference,
            originalTxLogId: dto.originalTxLogId,
          },
        });
        await tx.chainOperation.update({
          where: { id: operation.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
        return log;
      });
      await this.audit(
        subject,
        'BALANCE_ADJUSTMENT_CONFIRMED',
        'TxLog',
        String(txLog.id),
        null,
        txLog,
        dto.reason,
        wallet.uidNew ?? wallet.uid ?? undefined,
        undefined,
        operation.id,
        txLog.id
      );
      // Adjustment is CONFIRMED and persisted above. The balance read is best-effort — a
      // chain-read failure here must not poison the confirmed operation (same class as /wallet).
      let balanceWei: string | null = null;
      try {
        balanceWei = (await this.chain.balanceOf(wallet.address)).toString();
      } catch {
        // balance unavailable; the adjustment already succeeded
      }
      return this.serialize({
        operationId: operation.id,
        txHash,
        status: 'CONFIRMED',
        balanceWei,
      });
    } catch (error) {
      await this.prisma.chainOperation.update({
        where: { id: operation.id },
        data: {
          status: txHash ? 'RECONCILIATION_REQUIRED' : 'FAILED',
          failureReason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  async audit(
    subject: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    before: unknown,
    after: unknown,
    reason?: string,
    userUid?: string,
    eventId?: string,
    chainOperationId?: string,
    txLogId?: number
  ) {
    return this.prisma.adminAuditLog.create({
      data: {
        actorNexusSubject: subject,
        action,
        resourceType,
        resourceId,
        before: before as any,
        after: after as any,
        reason,
        userUid,
        eventId,
        chainOperationId,
        txLogId,
      },
    });
  }
}
