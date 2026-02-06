import { keccak256, toUtf8Bytes, getAddress } from 'ethers';

/**
 * Deterministički generiše EVM adresu iz user UID-a
 *
 * PH1 dizajn:
 * - Nema user-managed wallet-a
 * - Backend-kontrolisan, custodial model
 * - Isti UID uvek daje istu adresu
 *
 * @param uid - User ID
 * @returns Ethereum adresa (0x...)
 */
export function deriveAddress(uid: string): string {
  if (!uid || typeof uid !== 'string') {
    throw new Error('INVALID_UID');
  }

  // Namespacing sprečava kolizije sa drugim sistemima
  const input = `ENERGENIUS:${uid}`;

  // keccak256 hash od UID-a
  const hash = keccak256(toUtf8Bytes(input));

  // Uzmi zadnjih 20 bytes (40 hex karaktera) → EVM adresa
  const addressHex = '0x' + hash.slice(-40);

  // getAddress() primenjuje EIP-55 checksum
  return getAddress(addressHex);
}
