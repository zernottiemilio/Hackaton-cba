import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usd, abreviarTx } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';
import { explorerTxUrl, etiquetaRed } from '../../utils/explorer';

export interface DetalleFirma {
  titulo: string;
  descripcion: string;
  usdcAMover?: number;
  items?: { label: string; value: string }[];
  /**
   * `false` cuando la acción NO emite transacción (por ejemplo enviar a
   * revisión, que es solo un cambio de estado en la base). El modal se
   * comporta como una confirmación común, sin comisión ni explorer.
   * Default `true`.
   */
  onChain?: boolean;
}

export interface ResultadoFirma {
  /** Signature real devuelta por el backend. Undefined si la acción no fue on-chain. */
  txSignature?: string;
  /** Transacciones secundarias de la misma acción (por ejemplo la comisión a la tesorería). */
  extras?: { label: string; txSignature: string | null }[];
}

interface Props {
  open: boolean;
  detalle: DetalleFirma;
  /**
   * Ejecuta la acción contra la API. El backend firma con la wallet custodial
   * del usuario y devuelve la signature. El modal la muestra con link al explorer.
   */
  onAprobar: () => Promise<ResultadoFirma | void>;
  onCerrar: () => void;
}

type Estado = 'esperando' | 'enviando' | 'confirmada' | 'error';

/**
 * Confirmación de una acción que el backend firma por el usuario.
 * Estados reales: esperando → enviando (mientras corre la mutación) →
 * confirmada (con la signature) o error (con el mensaje del backend).
 */
export function FirmaTxModal({ open, detalle, onAprobar, onCerrar }: Props) {
  const [estado, setEstado] = useState<Estado>('esperando');
  const [signature, setSignature] = useState<string | null>(null);
  const [extras, setExtras] = useState<{ label: string; txSignature: string | null }[]>([]);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const conectada = useWalletStore((s) => s.conectada);
  const refrescar = useWalletStore((s) => s.refrescar);
  const onChain = detalle.onChain ?? true;

  useEffect(() => {
    if (open) {
      setEstado('esperando');
      setSignature(null);
      setExtras([]);
      setMensajeError(null);
    }
  }, [open]);

  const handleAprobar = async () => {
    setEstado('enviando');
    try {
      const r = await onAprobar();
      setSignature(r?.txSignature ?? null);
      setExtras(r?.extras ?? []);
      setEstado('confirmada');
      if (onChain) void refrescar();
    } catch (e) {
      setMensajeError(extraerMensaje(e));
      setEstado('error');
    }
  };

  const red = conectada?.network ?? 'mock';
  const linkTx = signature ? explorerTxUrl(signature, red) : null;

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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-full max-w-sm px-4"
          >
            {/* max-h + scroll: con muchos ítems (desglose de fee) el modal superaba el alto
                de la pantalla y los botones Aprobar/Cancelar quedaban fuera de la vista. */}
            <div className="bg-[#0F1216] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto max-h-[92vh]">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-gradient-to-r from-emerald-600/10 to-teal-600/10">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg">
                  ⬢
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm leading-tight">
                    {onChain ? 'Aprobá la transacción' : 'Confirmá la acción'}
                  </div>
                  <div className="text-white/40 text-[10px] mt-0.5">
                    {onChain ? `Harvest · ${etiquetaRed(red)}` : 'Harvest · sin transacción on-chain'}
                  </div>
                </div>
              </div>

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

                    {onChain && (
                      <div className="bg-black/40 rounded-lg p-3 mb-4 border border-white/5">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-white/40">Firma</span>
                          <span className="text-white/70">Wallet custodial · gas lo paga la plataforma</span>
                        </div>
                        {detalle.usdcAMover !== undefined && detalle.usdcAMover > 0 && (
                          <div className="flex justify-between items-baseline text-xs mt-1.5 pt-1.5 border-t border-white/5">
                            <span className="text-white/40">Transferencia USDC</span>
                            <span className="text-emerald-400 tabular-nums font-medium">{usd(detalle.usdcAMover, 2)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {onChain && conectada && (
                      <div className="text-white/30 text-[10px] font-mono mb-4 break-all">
                        Wallet: {conectada.address}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={onCerrar}
                        className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAprobar}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-900/40"
                      >
                        {onChain ? 'Aprobar' : 'Confirmar'}
                      </button>
                    </div>
                  </>
                )}

                {estado === 'enviando' && (
                  <div className="flex flex-col items-center py-6">
                    <div className="h-14 w-14 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin mb-4" />
                    <div className="text-white font-medium text-sm">
                      {onChain ? 'Firmando y confirmando en la red…' : 'Guardando…'}
                    </div>
                    <div className="text-white/40 text-xs mt-1.5">
                      {onChain ? 'Solana devnet suele tardar unos segundos' : 'Un momento'}
                    </div>
                  </div>
                )}

                {estado === 'confirmada' && (
                  <div className="flex flex-col items-center py-4">
                    <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="rgb(52 211 153)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="text-white font-medium text-sm">
                      {onChain ? 'Transacción confirmada' : 'Listo'}
                    </div>
                    {signature && (
                      <div className="mt-3 w-full bg-black/40 rounded-lg p-3 border border-white/5 text-center">
                        <div className="text-white/40 text-[10px] mb-1">Signature</div>
                        <div className="text-white/80 text-xs font-mono">{abreviarTx(signature)}</div>
                        {linkTx ? (
                          <a
                            href={linkTx}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-2 text-emerald-400 text-xs font-semibold hover:underline"
                          >
                            Ver en Solana Explorer ↗
                          </a>
                        ) : (
                          <div className="text-white/30 text-[10px] mt-2">Simulación: sin registro on-chain</div>
                        )}
                      </div>
                    )}
                    {extras.length > 0 && (
                      <div className="mt-2 w-full bg-black/40 rounded-lg p-3 border border-white/5 space-y-2">
                        {extras.map((e, i) => {
                          const l = e.txSignature ? explorerTxUrl(e.txSignature, red) : null;
                          return (
                            <div key={i} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-white/50">{e.label}</span>
                              {e.txSignature ? (
                                l ? (
                                  <a href={l} target="_blank" rel="noreferrer" className="text-emerald-400 font-mono hover:underline">
                                    {abreviarTx(e.txSignature)} ↗
                                  </a>
                                ) : (
                                  <span className="text-white/60 font-mono">{abreviarTx(e.txSignature)}</span>
                                )
                              ) : (
                                <span className="text-amber-300/80">pendiente</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={onCerrar}
                      className="mt-4 w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 text-sm font-medium transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                )}

                {estado === 'error' && (
                  <div className="flex flex-col items-center py-4">
                    <div className="h-14 w-14 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="rgb(251 113 133)" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="text-white font-medium text-sm">
                      {onChain ? 'Falló la transacción' : 'No se pudo completar'}
                    </div>
                    {mensajeError && (
                      <div className="text-rose-300/80 text-xs mt-2 text-center leading-relaxed break-words max-w-full">
                        {mensajeError}
                      </div>
                    )}
                    <div className="flex gap-2 mt-4 w-full">
                      <button
                        onClick={onCerrar}
                        className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={handleAprobar}
                        className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold"
                      >
                        Reintentar
                      </button>
                    </div>
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

function extraerMensaje(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as {
      response?: {
        data?: {
          message?: string | string[];
          errors?: Array<{ path?: unknown; message?: string }>;
        };
      };
    }).response;
    // El log completo va a consola: sirve para diagnosticar rápido cuando
    // el mensaje textual del backend es solo "Validation failed".
    if (r?.data) console.error('[FirmaTxModal] error backend', r.data);

    const detalles = r?.data?.errors;
    if (Array.isArray(detalles) && detalles.length > 0) {
      return detalles
        .map((d) => {
          const path = Array.isArray(d.path) ? d.path.join('.') : '';
          const msg = d.message ?? '';
          return path ? `${path}: ${msg}` : msg;
        })
        .filter(Boolean)
        .join(' · ');
    }
    const m = r?.data?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
  }
  return e instanceof Error ? e.message : 'Error desconocido';
}
