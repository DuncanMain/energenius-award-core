import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminPermissionEnum } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChainService } from '@/chain/chain.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ChainReconciliationService } from '@/reconciliation/chain-reconciliation.service';
import { AdminGuard } from './admin.guard';
import { RequireAdminPermissions } from './admin-permissions.decorator';
import { AdminService } from './admin.service';
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

@Controller('admin')
@UseGuards(AdminGuard)
@ApiTags('Administration')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Nexus token is missing or inactive.' })
@ApiForbiddenResponse({
  description:
    'The Nexus subject is not an enabled administrator or lacks the required permission.',
})
export class AdminController {
  constructor(
    private readonly chain: ChainService,
    private readonly prisma: PrismaService,
    private readonly reconciliation: ChainReconciliationService,
    private readonly adminService: AdminService
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get the authenticated administrator',
    description:
      'Uses the Nexus token subject (`sub`) to load the enabled local administrator and its permissions.',
  })
  @ApiOkResponse({ description: 'Administrator identity and permissions.' })
  async me(@Req() request: any) {
    return {
      nexusSubject: request.admin.nexusSubject,
      displayName: request.admin.displayName,
      enabled: request.admin.enabled,
      permissions: request.admin.permissions,
    };
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get operational dashboard totals and attention items',
  })
  @ApiOkResponse({
    description: 'Award, spend, chain-operation and audit summary.',
  })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_DASHBOARD_VIEW)
  overview() {
    return this.adminService.overview();
  }

  @Get('users')
  @ApiOperation({ summary: 'Search and paginate managed user wallets' })
  @ApiOkResponse({
    description:
      'Paginated wallet registry. Email search is reported unavailable when Nexus does not expose it.',
  })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_WALLET_READ)
  users(@Query() query: PageQueryDto) {
    return this.adminService.users(query);
  }

  @Get('users/:identifier')
  @ApiOperation({
    summary: 'Get a wallet, on-chain balance and transaction history',
  })
  @ApiOkResponse({
    description:
      'Wallet detail using Nexus user ID, legacy UID or wallet address.',
  })
  @ApiNotFoundResponse({ description: 'Wallet not found.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_WALLET_READ)
  user(@Param('identifier') identifier: string) {
    return this.adminService.userDetail(identifier);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Search durable blockchain operations' })
  @ApiOkResponse({
    description:
      'Paginated operations with matching confirmed transaction logs.',
  })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_TRANSACTION_READ)
  transactions(@Query() query: PageQueryDto) {
    return this.adminService.transactions(query);
  }

  @Get('reward-events')
  @ApiOperation({ summary: 'List rewardable event rules' })
  @ApiOkResponse({ description: 'Paginated rewardable-event configuration.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_READ)
  rewardEvents(@Query() query: PageQueryDto) {
    return this.adminService.rules(query);
  }

  @Get('reward-events/:id')
  @ApiOperation({ summary: 'Get a rewardable event and its audit history' })
  @ApiNotFoundResponse({ description: 'Rewardable event not found.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_READ)
  rewardEvent(@Param('id') id: string) {
    return this.adminService.rule(id);
  }

  @Post('reward-events')
  @ApiOperation({ summary: 'Create a rewardable event' })
  @ApiCreatedResponse({ description: 'Created rewardable event.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_CREATE)
  createRewardEvent(@Body() body: CreateAwardRuleDto, @Req() request: any) {
    return this.adminService.createRule(body, request.adminSubject);
  }

  @Patch('reward-events/:id')
  @ApiOperation({
    summary: 'Update or retire a rewardable event',
    description:
      'A used partner event ID is immutable. Retire it and create a replacement instead.',
  })
  @ApiOkResponse({ description: 'Updated rewardable event.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_UPDATE)
  updateRewardEvent(
    @Param('id') id: string,
    @Body() body: UpdateAwardRuleDto,
    @Req() request: any
  ) {
    return this.adminService.updateRule(id, body, request.adminSubject);
  }

  @Get('token-rules')
  @ApiOperation({ summary: 'Get the global award cap and exemptions' })
  @ApiOkResponse({
    description: 'Current token policy, exemptions and audit history.',
  })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_READ)
  tokenRules() {
    return this.adminService.tokenPolicy();
  }

  @Patch('token-rules')
  @ApiOperation({ summary: 'Update the global award cap and exemptions' })
  @ApiOkResponse({ description: 'Updated token policy.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_TOKEN_RULE_MANAGE)
  updateTokenRules(@Body() body: UpdateTokenPolicyDto, @Req() request: any) {
    return this.adminService.updateTokenPolicy(body, request.adminSubject);
  }

  @Get('component-sources')
  @ApiOperation({
    summary: 'Get component/source mappings and observations',
    description:
      'Source matching is observation-only by default and does not reject existing partner requests.',
  })
  @ApiOkResponse({
    description: 'Policy, configured mappings and recent observations.',
  })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_READ)
  componentSources() {
    return this.adminService.componentSources();
  }

  @Post('component-sources')
  @ApiOperation({ summary: 'Create or re-enable a component/source mapping' })
  @ApiCreatedResponse({ description: 'Saved component/source mapping.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_UPDATE)
  createComponentSource(
    @Body() body: CreateComponentSourceMappingDto,
    @Req() request: any
  ) {
    return this.adminService.createComponentSource(body, request.adminSubject);
  }

  @Patch('component-sources/:id')
  @ApiOperation({ summary: 'Enable or disable a component/source mapping' })
  @ApiOkResponse({ description: 'Updated mapping.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AWARD_RULE_UPDATE)
  updateComponentSource(
    @Param('id') id: string,
    @Body() body: UpdateComponentSourceMappingDto,
    @Req() request: any
  ) {
    return this.adminService.updateComponentSource(
      id,
      body,
      request.adminSubject
    );
  }

  @Post('adjustments')
  @ApiOperation({
    summary: 'Submit an audited manual balance adjustment',
    description:
      'Creates an idempotent durable operation, submits the ENcoin transaction and records reconciliation state if confirmation cannot be persisted.',
  })
  @ApiCreatedResponse({
    description: 'Confirmed adjustment or an existing idempotent operation.',
  })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_BALANCE_ADJUST)
  adjustment(@Body() body: AdjustmentDto, @Req() request: any) {
    return this.adminService.adjust(body, request.adminSubject);
  }

  @Get('administrators')
  @ApiOperation({ summary: 'List Nexus-sub administrator registrations' })
  @ApiOkResponse({ description: 'Paginated administrator registrations.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_ACCESS_MANAGE)
  administrators(@Query() query: PageQueryDto) {
    return this.adminService.admins(query);
  }

  @Post('administrators')
  @ApiOperation({ summary: 'Register a Nexus subject as an administrator' })
  @ApiCreatedResponse({ description: 'Created administrator.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_ACCESS_MANAGE)
  createAdministrator(@Body() body: CreateAdminDto, @Req() request: any) {
    return this.adminService.createAdmin(body, request.adminSubject);
  }

  @Patch('administrators/:id')
  @ApiOperation({
    summary: 'Update administrator status or permissions',
    description: 'Prevents removal of the final enabled access administrator.',
  })
  @ApiOkResponse({ description: 'Updated administrator.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_ACCESS_MANAGE)
  updateAdministrator(
    @Param('id') id: string,
    @Body() body: UpdateAdminDto,
    @Req() request: any
  ) {
    return this.adminService.updateAdmin(id, body, request.adminSubject);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Search administrator audit records' })
  @ApiOkResponse({ description: 'Paginated append-only audit records.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_AUDIT_READ)
  auditLogs(@Query() query: PageQueryDto) {
    return this.adminService.auditLogs(query);
  }

  @Get('system/health')
  @ApiOperation({
    summary: 'Inspect contract, signer, treasury and reconciliation health',
  })
  @ApiOkResponse({ description: 'Live blockchain and reconciliation health.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_SYSTEM_HEALTH_READ)
  async health() {
    const [owner, treasury, paused, metadata, code, head, cursor] =
      await Promise.all([
        this.chain.owner(),
        this.chain.treasury(),
        this.chain.paused(),
        this.chain.metadata(),
        this.chain.getCode(),
        this.chain.getBlockNumber(),
        this.prisma.chainSyncCursor.findUnique({
          where: { chainId: this.chain.getChainId() },
        }),
      ]);
    const signer = this.chain.getSignerAddress();
    return {
      chain_id: this.chain.getChainId(),
      contract_address: this.chain.getContractAddress(),
      contract_deployed: code !== '0x',
      signer_address: signer,
      owner_address: owner,
      signer_is_owner: signer.toLowerCase() === owner.toLowerCase(),
      treasury_address: treasury,
      treasury_balance_wei: (await this.chain.balanceOf(treasury)).toString(),
      paused,
      token: { ...metadata, totalSupply: metadata.totalSupply.toString() },
      latest_block: head,
      last_reconciled_block: cursor?.lastProcessedBlock.toString() ?? null,
    };
  }

  @Post('reconciliation/run')
  @ApiOperation({ summary: 'Run blockchain-to-PostgreSQL reconciliation now' })
  @ApiCreatedResponse({
    description: 'Reconciliation result and updated cursor.',
  })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_TRANSACTION_RECONCILE)
  async reconcile(@Req() request: any) {
    const result = await this.reconciliation.syncOnce();
    await this.adminService.audit(
      request.adminSubject,
      'RECONCILIATION_RUN',
      'chain',
      null,
      null,
      result
    );
    return result;
  }

  @Post('contract/pause')
  @ApiOperation({ summary: 'Pause the deployed ENcoin contract' })
  @ApiHeader({
    name: 'x-admin-confirmation',
    required: true,
    description: 'Must be exactly `PAUSE ENCOIN`.',
    example: 'PAUSE ENCOIN',
  })
  @ApiCreatedResponse({ description: 'Confirmed pause transaction.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_CONTRACT_PAUSE)
  async pause(
    @Req() request: any,
    @Headers('x-admin-confirmation') confirmation?: string
  ) {
    if (confirmation !== 'PAUSE ENCOIN') {
      throw new BadRequestException('Confirmation header must be PAUSE ENCOIN');
    }
    const txHash = await this.chain.pause();
    await this.adminService.audit(
      request.adminSubject,
      'CONTRACT_PAUSED',
      'contract',
      txHash,
      null,
      {
        txHash,
      }
    );
    return { tx_hash: txHash, paused: true };
  }

  @Post('contract/unpause')
  @ApiOperation({ summary: 'Unpause the deployed ENcoin contract' })
  @ApiHeader({
    name: 'x-admin-confirmation',
    required: true,
    description: 'Must be exactly `UNPAUSE ENCOIN`.',
    example: 'UNPAUSE ENCOIN',
  })
  @ApiCreatedResponse({ description: 'Confirmed unpause transaction.' })
  @RequireAdminPermissions(AdminPermissionEnum.ADMIN_CONTRACT_UNPAUSE)
  async unpause(
    @Req() request: any,
    @Headers('x-admin-confirmation') confirmation?: string
  ) {
    if (confirmation !== 'UNPAUSE ENCOIN') {
      throw new BadRequestException(
        'Confirmation header must be UNPAUSE ENCOIN'
      );
    }
    const txHash = await this.chain.unpause();
    await this.adminService.audit(
      request.adminSubject,
      'CONTRACT_UNPAUSED',
      'contract',
      txHash,
      null,
      {
        txHash,
      }
    );
    return { tx_hash: txHash, paused: false };
  }
}
