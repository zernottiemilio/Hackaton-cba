import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react';
import { useAuthStore, type RolPlataforma } from '@/stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import { abreviarAddress } from '../../utils/format';
import { etiquetaRed, explorerAddressUrl } from '../../utils/explorer';

/**
 * MenuPerfil — chip de usuario en el topbar + dropdown con detalles.
 *
 * Reemplaza el chip anterior que disparaba un `confirm()` nativo del browser
 * al primer click. Ahora el click abre un dropdown Harvest con perfil,
 * wallet, balances y un CTA para cerrar sesión que muestra un modal propio.
 *
 * Cerrar: click afuera, tecla Escape o Cerrar sesión → confirmación modal.
 */
export function MenuPerfil() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const conectada = useWalletStore((s) => s.conectada);
  const desconectar = useWalletStore((s) => s.desconectar);
  const navigate = useNavigate();

  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmarLogout, setConfirmarLogout] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar con click afuera o tecla Escape
  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  if (!usuario) return null;

  const inicial = usuario.nombre[0]?.toUpperCase() ?? '?';
  const linkExplorer = conectada ? explorerAddressUrl(conectada.address, conectada.network) : null;

  const copiarWallet = async () => {
    if (!conectada?.address) return;
    try {
      await navigator.clipboard.writeText(conectada.address);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      /* clipboard puede fallar en http */
    }
  };

  const cerrarSesionConfirmada = () => {
    desconectar();
    logout();
    setConfirmarLogout(false);
    setAbierto(false);
    navigate('/login', { replace: true });
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-2.5 transition-all"
          style={{
            padding: '6px 10px 6px 6px',
            borderRadius: 10,
            background: abierto ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            border: '1px solid var(--hv-border)',
            boxShadow: 'var(--hv-inset-top)',
            cursor: 'pointer',
          }}
          title="Ver perfil"
          aria-expanded={abierto}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--hv-green-deep), var(--hv-green-mid))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--hv-bg-token)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {inicial}
          </span>
          <div className="flex flex-col items-start leading-none">
            <span style={{ color: 'var(--hv-text)', fontSize: 12, fontWeight: 600 }}>
              {usuario.nombre.split(' ')[0]}
            </span>
            {usuario.rolPlataforma && (
              <span
                className="hv-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--hv-text-muted)',
                  marginTop: 2,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {nombreRol(usuario.rolPlataforma).toLowerCase()}
              </span>
            )}
          </div>
          <ChevronDown
            className="h-3 w-3 transition-transform"
            style={{
              color: 'var(--hv-text-muted)',
              transform: abierto ? 'rotate(180deg)' : 'rotate(0)',
            }}
          />
        </button>

        <AnimatePresence>
          {abierto && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 mt-2 z-[60]"
              style={{
                width: 300,
                background: 'var(--hv-bg-panel)',
                border: '1px solid var(--hv-border)',
                borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5), var(--hv-inset-top)',
                overflow: 'hidden',
              }}
            >
              {/* Header: avatar + nombre + email */}
              <div
                className="px-4 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--hv-green-deep), var(--hv-green-mid))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--hv-bg-token)',
                    fontWeight: 700,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {inicial}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate"
                    style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 600 }}
                    title={usuario.nombre}
                  >
                    {usuario.nombre}
                  </div>
                  <div
                    className="truncate"
                    style={{ color: 'var(--hv-text-muted)', fontSize: 11 }}
                    title={usuario.email}
                  >
                    {usuario.email}
                  </div>
                </div>
              </div>

              {/* Rol */}
              {usuario.rolPlataforma && (
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
                  <span className="hv-label-sm" style={{ fontSize: 10 }}>Rol</span>
                  <span
                    className="hv-chip hv-chip-green"
                    style={{ fontSize: 11, padding: '3px 10px' }}
                  >
                    {nombreRol(usuario.rolPlataforma)}
                  </span>
                </div>
              )}

              {/* Wallet + balances */}
              <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <span className="hv-label-sm" style={{ fontSize: 10 }}>Wallet</span>
                  <span style={{ color: 'var(--hv-text-muted)', fontSize: 10 }}>
                    {conectada ? etiquetaRed(conectada.network) : 'no conectada'}
                  </span>
                </div>
                {conectada ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="hv-mono flex-1 truncate"
                        style={{ color: 'var(--hv-text-2)', fontSize: 12 }}
                        title={conectada.address}
                      >
                        {abreviarAddress(conectada.address, 6, 6)}
                      </span>
                      <button
                        type="button"
                        onClick={copiarWallet}
                        className="p-1 rounded hover:bg-white/5 transition-colors"
                        style={{ color: 'var(--hv-text-muted)' }}
                        aria-label="Copiar address"
                      >
                        {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      {linkExplorer && (
                        <a
                          href={linkExplorer}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded hover:bg-white/5 transition-colors"
                          style={{ color: 'var(--hv-text-muted)' }}
                          aria-label="Ver en explorer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <BalanceCell label="SOL" valor={conectada.balanceSol.toFixed(3)} />
                      <BalanceCell label="USDC" valor={conectada.balanceUsdc.toLocaleString('es-AR', { maximumFractionDigits: 2 })} />
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--hv-text-muted)', fontSize: 11 }}>
                    Conectá tu wallet desde el botón de arriba para verla acá.
                  </div>
                )}
              </div>

              {/* Cerrar sesión */}
              <button
                onClick={() => {
                  setAbierto(false);
                  setConfirmarLogout(true);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-3 transition-colors"
                style={{
                  color: 'var(--hv-red-text)',
                  fontSize: 13,
                  fontWeight: 500,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hv-red-soft)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmarLogoutModal
        open={confirmarLogout}
        nombre={usuario.nombre}
        onCancelar={() => setConfirmarLogout(false)}
        onConfirmar={cerrarSesionConfirmada}
      />
    </>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────

function BalanceCell({ label, valor }: { label: string; valor: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--hv-border-subtle)',
        borderRadius: 8,
        padding: '6px 10px',
      }}
    >
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div
        className="hv-mono"
        style={{ color: 'var(--hv-text)', fontSize: 13, fontWeight: 600, marginTop: 1 }}
      >
        {valor}
      </div>
    </div>
  );
}

function ConfirmarLogoutModal({
  open,
  nombre,
  onCancelar,
  onConfirmar,
}: {
  open: boolean;
  nombre: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancelar]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]"
            onClick={onCancelar}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-full max-w-sm px-4"
          >
            <div
              style={{
                background: 'var(--hv-bg-panel)',
                border: '1px solid var(--hv-border)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0,0,0,0.6), var(--hv-inset-top)',
              }}
            >
              <div className="px-5 py-5">
                <div
                  className="flex items-center gap-3 mb-4"
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--hv-red-soft)',
                      border: '1px solid var(--hv-red-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--hv-red-text)',
                      flexShrink: 0,
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600 }}>
                      ¿Cerrar sesión?
                    </div>
                    <div
                      className="truncate"
                      style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 2 }}
                    >
                      {nombre}
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    color: 'var(--hv-text-2)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    marginBottom: 20,
                  }}
                >
                  Tu wallet y tus tenencias quedan seguras. Volvés cuando quieras con tu email
                  y contraseña.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={onCancelar}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--hv-text-2)',
                      border: '1px solid var(--hv-border)',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onConfirmar}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: 'var(--hv-red)',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function nombreRol(rol: RolPlataforma): string {
  switch (rol) {
    case 'productor':
      return 'Productor';
    case 'inversor':
      return 'Inversor';
    case 'acopio':
      return 'Acopio';
    case 'admin_plataforma':
      return 'Admin';
  }
}
