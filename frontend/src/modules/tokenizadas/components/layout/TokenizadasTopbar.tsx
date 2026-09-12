import { WalletButton } from '../wallet/WalletButton';
import { SwitchContexto } from './SwitchContexto';
import { useWalletStore, nombreContexto } from '../../stores/walletStore';

export function TokenizadasTopbar() {
  const contextoActivo = useWalletStore((s) => s.contextoActivo);

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-6"
      style={{
        background: 'rgba(6, 6, 10, 0.65)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--hv-border-subtle)',
      }}
    >
      <div className="flex items-center gap-4">
        {contextoActivo && (
          <div className="flex items-center gap-2">
            <span className="hv-label-sm" style={{ fontSize: 10 }}>
              Vista
            </span>
            <span style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 13 }}>
              {nombreContexto(contextoActivo)}
            </span>
          </div>
        )}
        <SwitchContexto />
      </div>
      <div className="flex items-center gap-3">
        <div
          className="hidden md:flex items-center gap-4 pr-3"
          style={{ borderRight: '1px solid var(--hv-border-subtle)' }}
        >
          <span
            className="flex items-center gap-1.5"
            style={{ fontFamily: 'var(--hv-font-mono)', fontSize: 11, color: 'var(--hv-text-muted)' }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'var(--hv-green)' }}
              />
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ background: 'var(--hv-green)' }}
              />
            </span>
            Solana · devnet
          </span>
          <span
            style={{
              fontFamily: 'var(--hv-font-mono)',
              fontSize: 11,
              color: 'var(--hv-text-muted)',
              letterSpacing: '0.02em',
            }}
          >
            slot 1,234,567
          </span>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
