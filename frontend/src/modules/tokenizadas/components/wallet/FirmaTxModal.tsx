import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usd } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';

export interface DetalleFirma {
  titulo: string;
  descripcion: string;
  costoSol?: number;
  usdcAMover?: number;
  items?: { label: string; value: string }[];
}

interface Props {
  open: boolean;
  detalle: DetalleFirma;
  onAprobar: () => Promise<void>;
  onRechazar: () => void;
}

/**
 * Modal que simula el popup de firma de Phantom. Se abre cuando el usuario
 * dispara una acción on-chain (publicar campaña, comprar tokens, reclamar).
 * Muestra los detalles de la transacción y pide aprobación.
 *
 * Cuando entre @solana/wallet-adapter, esto se reemplaza por la ventana
 * nativa de Phantom.
 */
export function FirmaTxModal({ open, detalle, onAprobar, onRechazar }: Props) {
  const [estado, setEstado] = useState<'esperando' | 'firmando' | 'confirmando' | 'confirmada' | 'error'>('esperando');
  const conectada = useWalletStore((s) => s.conectada);

  // Reset al abrir
  useEffect(() => {
    if (open) setEstado('esperando');
  }, [open]);

  const handleAprobar = async () => {
    setEstado('firmando');
    try {
      await new Promise((r) => setTimeout(r, 600)); // "confirmando firma"
      setEstado('confirmando');
      await onAprobar();
      setEstado('confirmada');
      await new Promise((r) => setTimeout(r, 900));
      onRechazar(); // usa el mismo para cerrar
    } catch {
      setEstado('error');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-full max-w-sm"
          >
            <div className="bg-[#0F1216] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header con marca de Phantom */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-gradient-to-r from-purple-600/10 to-indigo-600/10">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg">
                  ⬢
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm leading-tight">Aprobá la transacción</div>
                  <div className="text-white/40 text-[10px] mt-0.5">AgroFácil · Solana devnet mock</div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                {estado === 'esperando' && (
                  <>
                    <div className="text-white/80 text-sm font-medium mb-1">{detalle.titulo}</div>
                    <div className="text-white/50 text-xs leading-relaxed mb-4">{detalle.descripcion}</div>

                    {detalle.items && detalle.items.length > 0 && (
                      <div className="bg-black/40 rounded-lg p-3 mb-4 space-y-1.5 border border-white/5">
                        {detalle.items.map((it, i) => (
                          <div key={i} className="flex justify-between items-baseline text-xs">
                            <span className="text-white/40">{it.label}</span>
                            <span className="text-white tabular-nums">{it.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-black/40 rounded-lg p-3 mb-4 border border-white/5">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-white/40">Comisión de red</span>
                        <span className="text-white tabular-nums">{(detalle.costoSol ?? 0.000005).toFixed(6)} SOL</span>
                      </div>
                      {detalle.usdcAMover !== undefined && detalle.usdcAMover > 0 && (
                        <div className="flex justify-between items-baseline text-xs mt-1.5 pt-1.5 border-t border-white/5">
                          <span className="text-white/40">Transferencia USDC</span>
                          <span className="text-emerald-400 tabular-nums font-medium">{usd(detalle.usdcAMover, 2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-white/30 text-[10px] font-mono mb-4 break-all">
                      Wallet: {conectada?.address}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={onRechazar}
                        className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-colors"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={handleAprobar}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-900/40"
                      >
                        Aprobar
                      </button>
                    </div>
                  </>
                )}

                {(estado === 'firmando' || estado === 'confirmando') && (
                  <div className="flex flex-col items-center py-6">
                    <div className="h-14 w-14 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-4" />
                    <div className="text-white font-medium text-sm">
                      {estado === 'firmando' ? 'Firmando...' : 'Confirmando en la red...'}
                    </div>
                    <div className="text-white/40 text-xs mt-1.5">
                      {estado === 'firmando' ? 'Aprobación de wallet' : 'Esperando confirmación de Solana'}
                    </div>
                  </div>
                )}

                {estado === 'confirmada' && (
                  <div className="flex flex-col items-center py-6">
                    <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="rgb(52 211 153)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="text-white font-medium text-sm">Transacción confirmada</div>
                    <div className="text-white/40 text-xs mt-1.5">Todo listo</div>
                  </div>
                )}

                {estado === 'error' && (
                  <div className="flex flex-col items-center py-6">
                    <div className="h-14 w-14 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="rgb(251 113 133)" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="text-white font-medium text-sm">Falló la transacción</div>
                    <button
                      onClick={onRechazar}
                      className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
