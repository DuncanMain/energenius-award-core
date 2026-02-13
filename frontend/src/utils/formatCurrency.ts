export function formatBalance(
  balance: number | string | null | undefined
): string {
  const numericBalance = Number(balance ?? 0);
  
  const roundedBalance = Math.round(numericBalance * 100) / 100;
  
  return roundedBalance.toFixed(2);
}


export function formatBalanceWithCurrency(
  balance: number | string | null | undefined
): string {
  return `$${formatBalance(balance)}`;
}


export function roundToTwoDecimals(num: number): number {
  return Math.round(num * 100) / 100;
}