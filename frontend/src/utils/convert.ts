import { formatEther } from "ethers";

export function convertToETH(value: bigint | string | number): string {
  return formatEther(value);
}