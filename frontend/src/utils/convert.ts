import { ethers } from "ethers";

export const convertToETH = (wei: number | string) => {
  return ethers.formatEther(wei.toString());
};
