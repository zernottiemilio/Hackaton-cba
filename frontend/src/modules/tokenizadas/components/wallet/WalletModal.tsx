import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WALLETS_DEMO, useWalletStore } from '../../stores/walletStore';
import { abreviarAddress, usd } from '../../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de conexión de wallet — simula el popup de Phantom.
 * En la demo mostramos las 6 wallets pre-cargadas para poder demostrar
 * cada contexto (productor, inversor, acopio, admin) sin registrarse.
 *
 * Cuando entre @solana/wallet-adapter, este modal se reemplaza por
 * el detector nativo de wallets Phantom/Solflare/Backpack.
 */
export function WalletModal({ open, onClose }: Props) {
  const conectar = useWalletStore((s) => s.conectar);
  const [conectando, setConectando] = useState<string | null>(null);

  const handleConectar = async (walletId: string) => {
    setConectando(walletId);
    // Simula la aprobación del usuario en Phantom
    await new Promise((r) => setTimeout(r, 900));
    conectar(walletId);
    setConectando(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div
              style={{
                background: 'var(--hv-bg-panel)',
                border: '1px solid var(--hv-border)',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0,0,0,0.6), var(--hv-inset-top)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-5"
                style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      height: 40,
                      width: 40,
                      borderRadius: 12,
                      background: 'var(--hv-green-soft)',
                      border: '1px solid rgba(43,224,106,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 120 120" fill="none">
                      <g clipPath="url(#wm-clip)" strokeLinecap="round" fill="none" strokeWidth="11">
                        <path d="M-6 106C22 106 34 84 60 84s40 22 66 22" stroke="#0A6B12" />
                        <path d="M-6 82C22 82 34 60 60 60s40 22 66 22" stroke="#12912a" />
                        <path d="M-6 58C22 58 34 36 60 36s40 22 66 22" stroke="#1fc04c" />
                        <path d="M-6 34C22 34 34 12 60 12s40 22 66 22" stroke="#2BE06A" />
                      </g>
                      <defs>
                        <clipPath id="wm-clip"><circle cx="60" cy="60" r="54" /></clipPath>
                      </defs>
                    </svg>
                  </div>
                  <div>
                    <h2 style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 15 }}>Conectar wallet</h2>
                    <p className="hv-label-sm" style={{ fontSize: 10, marginTop: 2 }}>Solana · devnet mock</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/40 hover:text-white/80 transition-colors"
                  aria-label="Cerrar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-2 max-h-[70vh] overflow-y-auto">
                <p className="text-white/50 text-xs px-4 pt-2 pb-3 leading-relaxed">
                  Elegí una wallet demo para explorar la plataforma. Cada una simula un perfil distinto.
                </p>
                <div className="space-y-1">
                  {WALLETS_DEMO.map((w) => {
                    const isConectando = conectando === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => handleConectar(w.id)}
                        disabled={!!conectando}
                        className={`w-full text-left rounded-xl px-4 py-3 transition-all group ${
                          isConectando
                            ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40'
                            : 'hover:bg-white/5 active:bg-white/10 disabled:opacity-40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-xl shrink-0">
                            {w.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium truncate">{w.nombre}</span>
                              {isConectando && (
                                <span className="text-[10px] text-emerald-400 font-medium">Aprobando...</span>
                              )}
                            </div>
                            <div className="text-white/40 text-[11px] mt-0.5 truncate">{w.descripcion}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-white/30 text-[10px] font-mono">
                                {abreviarAddress(w.address, 6, 4)}
                              </span>
                              <span className="text-white/60 text-[10px] tabular-nums">
                                {usd(w.balanceUsdc, 0)} <span className="text-white/30">USDC</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 shrink-0">
                            {w.contextos.map((ctx) => (
                              <span
                                key={ctx}
                                className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                  ctx === 'productor'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : ctx === 'inversor'
                                    ? 'bg-sky-500/15 text-sky-300'
                                    : ctx === 'acopio'
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-purple-500/15 text-purple-300'
                                }`}
                              >
                                {ctx === 'admin_plataforma' ? 'admin' : ctx}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div
                className="px-6 py-3 flex items-center justify-between hv-label-sm"
                style={{ borderTop: '1px solid var(--hv-border-subtle)', fontSize: 9 }}
              >
                <span>Wallet mock · sin tx reales on-chain</span>
                <span className="hv-mono">harvest.fi v0.1</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
