import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useWalletStore, useNombreWallet } from '../../stores/walletStore';
import { abreviarAddress, usd } from '../../utils/format';
import { etiquetaRed, explorerAddressUrl } from '../../utils/explorer';
import { WalletModal } from './WalletModal';

/**
 * Chip compacto para el topbar. Muestra la wallet custodial del usuario
 * logueado con balances reales. Al montar con wallet conectada, refresca
 * balances (pueden haber cambiado por una tx en otra pantalla).
 */
export function WalletButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { conectada, desconectar, refrescar } = useWalletStore();
  const nombre = useNombreWallet();

  useEffect(() => {
    if (conectada) void refrescar();
    // Solo al montar: refrescar lee el store por su cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!conectada) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="hv-cta"
          style={{ padding: '9px 16px', fontSize: 13, borderRadius: 10 }}
        >
          <span className="inline-flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M21 8v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8m18 0V6a2 2 0 00-2-2H5a2 2 0 00-2 2v2m18 0H3m14 4h2" />
            </svg>
            Conectar wallet
          </span>
        </button>
        <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const linkExplorer = explorerAddressUrl(conectada.address, conectada.network);

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-3 transition-all"
        style={{
          padding: '7px 12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--hv-border)',
          boxShadow: 'var(--hv-inset-top)',
        }}
      >
        <span className="relative flex h-2 w-2">
          <span
            className="animate-pulse absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: 'var(--hv-green)' }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ background: 'var(--hv-green)' }}
          />
        </span>
        <div className="flex flex-col items-start leading-none">
          <span style={{ color: 'var(--hv-text)', fontSize: 12, fontWeight: 600 }}>
            {nombre}
          </span>
          <span
            className="hv-mono"
            style={{ color: 'var(--hv-text-muted)', fontSize: 10, marginTop: 2, letterSpacing: '0.02em' }}
          >
            {abreviarAddress(conectada.address)}
          </span>
        </div>
        <div className="flex flex-col items-end leading-none pl-3" style={{ borderLeft: '1px solid var(--hv-border)' }}>
          <span
            className="hv-mono"
            style={{ color: 'var(--hv-green-text)', fontSize: 12, fontWeight: 600 }}
          >
            {usd(conectada.balanceUsdc, 0)}
          </span>
          <span
            className="hv-label-sm"
            style={{ fontSize: 9, marginTop: 2 }}
          >
            USDC
          </span>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--hv-text-muted)' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden z-50"
            style={{
              background: 'var(--hv-bg-panel)',
              border: '1px solid var(--hv-border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), var(--hv-inset-top)',
            }}
          >
            <div className="p-4" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <div className="hv-label-sm" style={{ fontSize: 10 }}>Wallet conectada</div>
                <div className="hv-label-sm" style={{ fontSize: 9, color: 'var(--hv-green-text)' }}>
                  {etiquetaRed(conectada.network)}
                </div>
              </div>
              <div style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {nombre}
              </div>
              <div
                className="hv-mono"
                style={{
                  color: 'var(--hv-text-muted)',
                  fontSize: 10.5,
                  wordBreak: 'break-all',
                  lineHeight: 1.55,
                  letterSpacing: '0.02em',
                }}
              >
                {conectada.address}
              </div>
              {linkExplorer && (
                <a
                  href={linkExplorer}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--hv-green-text)', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 8 }}
                >
                  Ver en Solana Explorer ↗
                </a>
              )}
            </div>
            <div className="p-4 space-y-2" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
              <BalanceRow label="SOL" value={conectada.balanceSol.toFixed(4)} />
              <BalanceRow label="USDC" value={usd(conectada.balanceUsdc, 2)} accent />
            </div>
            <button
              onClick={() => {
                void refrescar();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                color: 'var(--hv-text)',
                fontSize: 13,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--hv-border-subtle)',
                cursor: 'pointer',
              }}
            >
              Actualizar balances
            </button>
            <button
              onClick={() => {
                desconectar();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                color: 'var(--hv-red-text)',
                fontSize: 13,
                fontWeight: 600,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hv-red-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Desconectar
            </button>
          </motion.div>
        </>
      )}
    </div>
  );
}

function BalanceRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="hv-label-sm" style={{ fontSize: 10 }}>
        {label}
      </span>
      <span
        className="hv-mono"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: accent ? 'var(--hv-green-text)' : 'var(--hv-text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
