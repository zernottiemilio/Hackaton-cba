import Decimal from 'decimal.js';

// USDC en Solana tiene 6 decimales. On-chain todo va en enteros (micro-USDC)
// para evitar floats. Convertir en un solo lugar: acá.

const MICRO_PER_USDC = 1_000_000;

/** micro-USDC (entero) → USD (float presentable). */
export function microUsdcToUsd(micro: bigint | number): number {
  const asNumber = typeof micro === 'bigint' ? Number(micro) : micro;
  return asNumber / MICRO_PER_USDC;
}

/** USD (Decimal, evita floats) → micro-USDC (bigint listo para el programa). */
export function usdToMicroUsdc(usd: Decimal): bigint {
  return BigInt(
    usd.mul(MICRO_PER_USDC).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString(),
  );
}
