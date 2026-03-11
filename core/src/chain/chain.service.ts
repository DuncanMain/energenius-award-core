import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import encoinAbi from './abi/encoin.abi.json';

@Injectable()
export class ChainService implements OnModuleInit {
  private provider: JsonRpcProvider;
  private signer: Wallet;
  private encoin: Contract;
  private chainId: number;

  constructor(private configService: ConfigService) {}
  
  private mustEnv(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value || value.trim() === '') {
      throw new Error(`${name} is not set`);
    }
    return value.trim();
  }

  onModuleInit() {
    const rpcUrl = this.mustEnv('AMOY_RPC_URL');
    this.chainId = Number(this.mustEnv('CHAIN_ID'));
    const contractAddress = this.mustEnv('ENCOIN_CONTRACT_ADDRESS');
    const privateKey = this.mustEnv('AMOY_PRIVATE_KEY');

    this.provider = new JsonRpcProvider(rpcUrl, this.chainId);
    this.signer = new Wallet(privateKey, this.provider);
    this.encoin = new Contract(contractAddress, encoinAbi, this.signer);
  }

  /**
   * Check balance of a given address in ENCOIN tokens
   */
  async balanceOf(address: string): Promise<bigint> {
    const bal = await this.encoin.balanceOf(address);
    return BigInt(bal.toString());
  }

  /**
   * Give tokens to a user (award)
   */
  async award(to: string, amountWei: bigint): Promise<string> {
    const tx = await this.encoin.award(to, amountWei);
    await tx.wait(); // Čeka blockchain confirmation
    return tx.hash as string;
  }

  /**
   * Take tokens from a user (spend)
   */
  async spend(from: string, amountWei: bigint): Promise<string> {
    const tx = await this.encoin.spend(from, amountWei);
    await tx.wait(); // Čeka blockchain confirmation
    return tx.hash as string;
  }

  /**
   * Returns the address of the smart contract owner
   */
  async owner(): Promise<string> {
    return await this.encoin.owner();
  }

  /**
   * Returns the chain ID
   */
  getChainId(): number {
    return this.chainId;
  }
}
