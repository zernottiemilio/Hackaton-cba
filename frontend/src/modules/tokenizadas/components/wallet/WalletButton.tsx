import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWalletStore, nombreWalletActiva } from '../../stores/walletStore';
import { abreviarAddress, usd } from '../../utils/format';
import { WalletModal } from './WalletModal';

/**
 * Chip compacto para el topbar. Si no hay wallet conectada, muestra
 * "Conectar wallet". Si hay, muestra address abreviada + balance USDC + botón desconectar.
 */
export function WalletButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { conectada, walletDemoId, desconectar } = useWalletStore();

  if (!conectada) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium shadow-lg shadow-purple-900/40 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21 8v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8m18 0V6a2 2 0 00-2-2H5a2 2 0 00-2 2v2m18 0H3m14 4h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Conectar wallet
        </button>
        <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <div className="flex flex-col items-start leading-none">
          <span className="text-white text-xs font-medium">{nombreWalletActiva(walletDemoId)}</span>
          <span className="text-white/40 text-[10px] font-mono mt-0.5">{abreviarAddress(conectada.address)}</span>
        </div>
        <div className="flex flex-col items-end leading-none border-l border-white/10 pl-3">
          <span className="text-white text-xs tabular-nums font-medium">{usd(conectada.balanceUsdc, 0)}</span>
          <span className="text-white/40 text-[10px] mt-0.5">USDC</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white/40">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-full mt-2 w-64 bg-[#0F1216] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-white/5">
              <div className="text-white/40 text-[10px] font-medium uppercase tracking-wide mb-1">
                Wallet conectada
              </div>
              <div className="text-white text-sm font-medium mb-2">{nombreWalletActiva(walletDemoId)}</div>
              <div className="text-white/50 text-[11px] font-mono break-all leading-relaxed">
                {conectada.address}
              </div>
            </div>
            <div className="p-3 border-b border-white/5 space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-white/50 text-xs">SOL</span>
                <span className="text-white tabular-nums text-sm">{conectada.balanceSol.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-white/50 text-xs">USDC</span>
                <span className="text-white tabular-nums text-sm">{usd(conectada.balanceUsdc, 2)}</span>
              </div>
            </div>
            <button
              onClick={() => {
                desconectar();
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-rose-400 text-sm hover:bg-rose-500/10 transition-colors"
            >
              Desconectar
            </button>
          </motion.div>
        </>
      )}
    </div>
  );
}
