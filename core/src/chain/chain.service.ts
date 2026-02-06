import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import * as encoinAbi from './encoin.abi.json';

@Injectable()
export class ChainService implements OnModuleInit {
  private provider: JsonRpcProvider;
  private signer: Wallet;
  private encoin: Contract;
  private chainId: number;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.mustEnv('AMOY_RPC_URL');
    this.chainId = Number(this.mustEnv('CHAIN_ID'));
    const contractAddress = this.mustEnv('ENCOIN_CONTRACT_ADDRESS');
    const privateKey = this.mustEnv('AMOY_PRIVATE_KEY');

    this.provider = new JsonRpcProvider(rpcUrl, this.chainId);
    this.signer = new Wallet(privateKey, this.provider);
    this.encoin = new Contract(contractAddress, encoinAbi, this.signer);
  }

  private mustEnv(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value || value.trim() === '') {
      throw new Error(`${name} is not set`);
    }
    return value.trim();
  }

  /**
   * Proverava balans korisnika na blockchain-u
   */
  async balanceOf(address: string): Promise<bigint> {
    const bal = await this.encoin.balanceOf(address);
    return BigInt(bal.toString());
  }

  /**
   * Daje tokene korisniku (award)
   */
  async award(to: string, amountWei: bigint): Promise<string> {
    const tx = await this.encoin.award(to, amountWei);
    await tx.wait(); // Čeka blockchain confirmation
    return tx.hash as string;
  }

  /**
   * Oduzima tokene od korisnika (spend)
   */
  async spend(from: string, amountWei: bigint): Promise<string> {
    const tx = await this.encoin.spend(from, amountWei);
    await tx.wait(); // Čeka blockchain confirmation
    return tx.hash as string;
  }

  /**
   * Vraća adresu vlasnika smart contract-a
   */
  async owner(): Promise<string> {
    return await this.encoin.owner();
  }

  /**
   * Vraća chain ID
   */
  getChainId(): number {
    return this.chainId;
  }
}
