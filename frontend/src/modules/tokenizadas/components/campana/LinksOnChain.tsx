import { useWalletStore } from '../../stores/walletStore';
import { explorerAddressUrl, explorerTxUrl } from '../../utils/explorer';

interface Props {
  /** Direcciones que ya vienen en cada Tokenizacion: no hace falta pedir nada más. */
  mintAddress?: string | null;
  vaultAddress?: string | null;
  txSignaturePublicacion?: string | null;
  /** Fila de tabla: más chico y en una línea. */
  compacto?: boolean;
  className?: string;
}

/**
 * Links de una cosecha a Solana Explorer: el token (mint), el vault con los
 * USDC y la transacción que la publicó. Va en cada lista y ficha para que
 * cualquiera pueda verificar la cosecha en la red sin buscar nada.
 * En modo mock (direcciones inventadas) no renderiza nada.
 */
export function LinksOnChain({ mintAddress, vaultAddress, txSignaturePublicacion, compacto = false, className }: Props) {
  const red = useWalletStore((s) => s.conectada?.network ?? 'devnet');
  const links = [
    { label: 'Token', href: mintAddress ? explorerAddressUrl(mintAddress, red) : null, title: 'Mint del token HRV de esta cosecha' },
    { label: 'Vault', href: vaultAddress ? explorerAddressUrl(vaultAddress, red) : null, title: 'Cuenta USDC del contrato (escrow)' },
    { label: 'Publicación', href: txSignaturePublicacion ? explorerTxUrl(txSignaturePublicacion, red) : null, title: 'Transacción create_campaign' },
  ].filter((l): l is { label: string; href: string; title: string } => !!l.href);

  if (links.length === 0) return null;

  return (
    <div
      className={`flex items-center flex-wrap ${compacto ? 'gap-x-2' : 'gap-x-3'} ${className ?? ''}`}
      style={{ fontSize: compacto ? 10 : 11, marginTop: compacto ? 3 : 6 }}
      onClick={(e) => e.stopPropagation()}
    >
      {!compacto && (
        <span className="hv-label-sm" style={{ fontSize: 9 }}>
          En Solana
        </span>
      )}
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          title={l.title}
          className="hv-mono hover:underline"
          style={{ color: 'var(--hv-green-text)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}
