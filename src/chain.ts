import { Contract, JsonRpcProvider, Wallet } from "ethers";
import encoinAbi from "./encoinAbi.json" assert { type: "json" };

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`${name} is not set`);
  return v.trim();
}

const rpcUrl = mustEnv("AMOY_RPC_URL");
const chainId = Number(mustEnv("CHAIN_ID"));
const contractAddress = mustEnv("ENCOIN_CONTRACT_ADDRESS");
const privateKey = mustEnv("AMOY_PRIVATE_KEY");

const provider = new JsonRpcProvider(rpcUrl, chainId);
const signer = new Wallet(privateKey, provider);

// Contract instance (connected with signer; for now we only use balanceOf)
const encoin = new Contract(contractAddress, encoinAbi, signer);

export async function balanceOf(address: string): Promise<bigint> {
  const bal = await encoin.balanceOf(address);
  return BigInt(bal.toString());
}

export async function award(to: string, amountWei: bigint): Promise<string> {
  const tx = await encoin.award(to, amountWei);
  await tx.wait(); // PH1: return only after confirmation
  return tx.hash as string;
}

export async function spend(from: string, amountWei: bigint): Promise<string> {
  const tx = await encoin.spend(from, amountWei);
  await tx.wait(); // PH1: return only after confirmation
  return tx.hash as string;
}

export async function owner(): Promise<string> {
  return await encoin.owner();
}

export function getChainId(): number {
  return chainId;
}

