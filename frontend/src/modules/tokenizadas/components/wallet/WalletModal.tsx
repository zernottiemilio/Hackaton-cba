import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useWalletStore, useNombreWallet } from '../../stores/walletStore';
import { abreviarAddress, usd } from '../../utils/format';
import { etiquetaRed, explorerAddressUrl } from '../../utils/explorer';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de conexión de la wallet custodial.
 *
 * No elige entre wallets: el usuario logueado tiene UNA wallet que el
 * backend genera y custodia. "Conectar" la pide al backend (la crea y la
 * fondea la primera vez) y muestra address real, balances y link al explorer.
 */
export function WalletModal({ open, onClose }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const nombre = useNombreWallet();
  const { conectada, conectando, error, conectar } = useWalletStore();
  const [recienConectada, setRecienConectada] = useState(false);

  const handleConectar = async () => {
    try {
      await conectar();
      setRecienConectada(true);
    } catch {
      /* el error queda en el store y se muestra abajo */
    }
  };

  const handleClose = () => {
    setRecienConectada(false);
    onClose();
  };

  const linkExplorer = conectada ? explorerAddressUrl(conectada.address, conectada.network) : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
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
                    <h2 style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 15 }}>Tu wallet en Solana</h2>
                    <p className="hv-label-sm" style={{ fontSize: 10, marginTop: 2 }}>
                      {conectada ? etiquetaRed(conectada.network) : 'Custodiada por AgroFácil'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/40 hover:text-white/80 transition-colors"
                  aria-label="Cerrar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                {!isAuthenticated ? (
                  <div className="text-center py-4">
                    <p style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 500 }}>
                      Iniciá sesión para usar tu wallet
                    </p>
                    <p className="text-white/50 text-xs mt-2 leading-relaxed">
                      Cada cuenta de AgroFácil tiene una wallet en Solana. No hay que instalar nada.
                    </p>
                    <Link to="/login" onClick={handleClose} className="hv-cta inline-block mt-5" style={{ padding: '10px 20px', fontSize: 13 }}>
                      Ingresar
                    </Link>
                  </div>
                ) : conectada ? (
                  <div>
                    {recienConectada && (
                      <div
                        className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg"
                        style={{ background: 'var(--hv-green-soft)', border: '1px solid rgba(43,224,106,0.28)' }}
                      >
                        <span style={{ color: 'var(--hv-green-text)', fontSize: 12, fontWeight: 600 }}>✓ Wallet conectada</span>
                      </div>
                    )}
                    <div className="hv-label-sm" style={{ fontSize: 10, marginBottom: 6 }}>Titular</div>
                    <div style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{nombre}</div>

                    <div className="hv-label-sm" style={{ fontSize: 10, marginBottom: 6 }}>Address</div>
                    <div
                      className="hv-mono"
                      style={{
                        color: 'var(--hv-text-muted)',
                        fontSize: 11,
                        wordBreak: 'break-all',
                        lineHeight: 1.55,
                        letterSpacing: '0.02em',
                        marginBottom: 14,
                      }}
                    >
                      {conectada.address}
                    </div>

                    <div
                      className="grid grid-cols-2 gap-3 mb-4"
                    >
                      <Balance label="USDC" value={usd(conectada.balanceUsdc, 2)} accent />
                      <Balance label="SOL" value={conectada.balanceSol.toFixed(4)} />
                    </div>

                    {linkExplorer ? (
                      <a
                        href={linkExplorer}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-center py-2.5 rounded-lg transition-colors"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid var(--hv-border)',
                          color: 'var(--hv-green-text)',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        Ver en Solana Explorer ↗
                      </a>
                    ) : (
                      <p className="text-white/40 text-[11px] text-center">
                        Modo simulación: el backend corre con <span className="hv-mono">LEDGER_IMPL=mock</span>.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-white/70 text-sm leading-relaxed">
                      Hola {nombre.split(' ')[0] || ''}. Tu wallet la genera y custodia AgroFácil: firmamos las
                      transacciones por vos y podés verificarlas en Solana Explorer.
                    </p>
                    {error && (
                      <p className="mt-3 text-xs" style={{ color: 'var(--hv-red-text)' }}>
                        {error}
                      </p>
                    )}
                    <button
                      onClick={handleConectar}
                      disabled={conectando}
                      className="hv-cta w-full mt-5"
                      style={{ padding: '11px 16px', fontSize: 14 }}
                    >
                      {conectando ? 'Conectando…' : 'Conectar mi wallet'}
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="px-6 py-3 flex items-center justify-between hv-label-sm"
                style={{ borderTop: '1px solid var(--hv-border-subtle)', fontSize: 9 }}
              >
                <span>{conectada ? abreviarAddress(conectada.address, 6, 6) : 'Wallet custodial'}</span>
                <span className="hv-mono">harvest.fi</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Balance({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: 'var(--hv-bg-input)',
        border: '1px solid var(--hv-border-subtle)',
      }}
    >
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div
        className="hv-mono"
        style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: accent ? 'var(--hv-green-text)' : 'var(--hv-text)' }}
      >
        {value}
      </div>
    </div>
  );
}
