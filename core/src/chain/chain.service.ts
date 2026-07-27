import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Contract,
  ContractTransactionResponse,
  JsonRpcProvider,
  TransactionReceipt,
  Wallet,
} from 'ethers';
import encoinAbi from './abi/encoin.abi.json';

@Injectable()
export class ChainService implements OnModuleInit {
  private provider: JsonRpcProvider;
  private signer: Wallet;
  private encoin: Contract;
  private chainId: number;
  private contractAddress: string;

  constructor(private configService: ConfigService) {}

  private mustEnv(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value || value.trim() === '') throw new Error(`${name} is not set`);
    return value.trim();
  }

  onModuleInit() {
    const rpcUrl = this.mustEnv('AMOY_RPC_URL');
    this.chainId = Number(this.mustEnv('CHAIN_ID'));
    this.contractAddress = this.mustEnv('ENCOIN_CONTRACT_ADDRESS');
    const privateKey = this.mustEnv('AMOY_PRIVATE_KEY');

    this.provider = new JsonRpcProvider(rpcUrl, this.chainId);
    this.signer = new Wallet(privateKey, this.provider);
    this.encoin = new Contract(this.contractAddress, encoinAbi, this.signer);
  }

  async balanceOf(address: string): Promise<bigint> {
    const balance = await this.encoin.balanceOf(address);
    return BigInt(balance.toString());
  }

  async submitAward(
    to: string,
    amountWei: bigint
  ): Promise<ContractTransactionResponse> {
    return this.encoin.award(to, amountWei);
  }

  async award(to: string, amountWei: bigint): Promise<string> {
    const tx = await this.submitAward(to, amountWei);
    await tx.wait();
    return tx.hash;
  }

  async submitSpend(
    from: string,
    amountWei: bigint
  ): Promise<ContractTransactionResponse> {
    return this.encoin.spend(from, amountWei);
  }

  async spend(from: string, amountWei: bigint): Promise<string> {
    const tx = await this.submitSpend(from, amountWei);
    await tx.wait();
    return tx.hash;
  }

  async waitForTransaction(txHash: string): Promise<TransactionReceipt> {
    const receipt = await this.provider.waitForTransaction(txHash);
    if (!receipt) throw new Error(`No receipt returned for ${txHash}`);
    if (receipt.status !== 1)
      throw new Error(`Transaction reverted: ${txHash}`);
    return receipt;
  }

  async getTransactionReceipt(txHash: string) {
    return this.provider.getTransactionReceipt(txHash);
  }

  async owner(): Promise<string> {
    return this.encoin.owner();
  }

  async treasury(): Promise<string> {
    return this.encoin.treasury();
  }

  async paused(): Promise<boolean> {
    return this.encoin.paused();
  }

  async metadata() {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      this.encoin.name(),
      this.encoin.symbol(),
      this.encoin.decimals(),
      this.encoin.totalSupply(),
    ]);
    return {
      name: String(name),
      symbol: String(symbol),
      decimals: Number(decimals),
      totalSupply: BigInt(totalSupply.toString()),
    };
  }

  async pause(): Promise<string> {
    const tx: ContractTransactionResponse = await this.encoin.pause();
    await tx.wait();
    return tx.hash;
  }

  async unpause(): Promise<string> {
    const tx: ContractTransactionResponse = await this.encoin.unpause();
    await tx.wait();
    return tx.hash;
  }

  async transferEvents(fromBlock: number, toBlock: number) {
    return this.encoin.queryFilter(
      this.encoin.filters.Transfer(),
      fromBlock,
      toBlock
    );
  }

  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async getCode(): Promise<string> {
    return this.provider.getCode(this.contractAddress);
  }

  getChainId(): number {
    return this.chainId;
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getSignerAddress(): string {
    return this.signer.address;
  }
}
