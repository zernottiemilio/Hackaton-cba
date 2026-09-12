import type { WalletInfo } from '../types/tokenizadas';

type Red = WalletInfo['network'];

const clusterQuery = (red: Red): string => (red === 'mainnet-beta' ? '' : `?cluster=${red}`);

/**
 * Links a Solana Explorer. En `mock` no hay nada que ver on-chain
 * (las signatures son uuid), así que devuelven null y la UI muestra
 * el hash sin link.
 */
export function explorerTxUrl(signature: string, red: Red): string | null {
  if (red === 'mock' || !signature) return null;
  return `https://explorer.solana.com/tx/${signature}${clusterQuery(red)}`;
}

export function explorerAddressUrl(address: string, red: Red): string | null {
  if (red === 'mock' || !address) return null;
  return `https://explorer.solana.com/address/${address}${clusterQuery(red)}`;
}

export function etiquetaRed(red: Red): string {
  switch (red) {
    case 'mainnet-beta':
      return 'Solana · mainnet';
    case 'devnet':
      return 'Solana · devnet';
    case 'mock':
      return 'Simulación · sin chain';
  }
}
