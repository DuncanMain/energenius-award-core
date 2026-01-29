import { keccak256, toUtf8Bytes, getAddress } from "ethers";

/**
 * Deterministically derive an EVM address from a user UID.
 *
 * PH1 design:
 * - No user-managed wallets
 * - Backend-controlled, custodial model
 * - Same UID must always map to the same address
 */
export function deriveAddress(uid: string): string {
  if (!uid || typeof uid !== "string") {
    throw new Error("INVALID_UID");
  }

  // Namespacing avoids collisions with other systems
  const input = `ENERGENIUS:${uid}`;

  // keccak256 hash of the UID
  const hash = keccak256(toUtf8Bytes(input));

  // Take the last 20 bytes (40 hex chars) → EVM address
  const addressHex = "0x" + hash.slice(-40);

  // getAddress() applies EIP-55 checksum
  return getAddress(addressHex);
}
