import { WalletButton } from '../wallet/WalletButton';
import { SwitchContexto } from './SwitchContexto';
import { useWalletStore, nombreContexto } from '../../stores/walletStore';

export function TokenizadasTopbar() {
  const contextoActivo = useWalletStore((s) => s.contextoActivo);

  return (
    <header className="h-14 shrink-0 bg-black/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-5">
      <div className="flex items-center gap-4">
        {contextoActivo && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40">Vista</span>
            <span className="text-white font-medium">{nombreContexto(contextoActivo)}</span>
          </div>
        )}
        <SwitchContexto />
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-4 text-[11px] text-white/40 pr-2 border-r border-white/5">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Solana devnet
          </span>
          <span className="tabular-nums">Slot 1,234,567</span>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
