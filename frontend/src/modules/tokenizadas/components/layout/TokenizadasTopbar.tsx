import { Link, useNavigate } from 'react-router-dom';
import { WalletButton } from '../wallet/WalletButton';
import { useAuthStore } from '@/stores/authStore';

/**
 * Topbar del shell Harvest.
 *
 * Sin sesión → status devnet + botón "Ingresar" verde.
 * Con sesión → status devnet + chip del usuario (nombre + rol) + wallet mock.
 * El botón de cerrar sesión vive dentro del menú del chip de usuario.
 */
export function TokenizadasTopbar() {
  const usuario = useAuthStore((s) => s.usuario);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-6"
      style={{
        background: 'rgba(6, 6, 10, 0.65)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--hv-border-subtle)',
      }}
    >
      {/* Izquierda: rol activo (si logueado) */}
      <div className="flex items-center gap-4">
        {isAuthenticated && usuario?.rolPlataforma && (
          <div className="flex items-center gap-2">
            <span className="hv-label-sm" style={{ fontSize: 10 }}>
              Rol
            </span>
            <span style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 13 }}>
              {nombreRol(usuario.rolPlataforma)}
            </span>
          </div>
        )}
      </div>

      {/* Derecha: status devnet + (login / usuario+wallet) */}
      <div className="flex items-center gap-3">
        <div
          className="hidden md:flex items-center gap-4 pr-3"
          style={{ borderRight: '1px solid var(--hv-border-subtle)' }}
        >
          <span
            className="flex items-center gap-1.5"
            style={{
              fontFamily: 'var(--hv-font-mono)',
              fontSize: 11,
              color: 'var(--hv-text-muted)',
            }}
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

        {isAuthenticated ? (
          <>
            <UsuarioChip />
            <WalletButton />
          </>
        ) : (
          <BotonIngresar />
        )}
      </div>
    </header>
  );
}

function BotonIngresar() {
  return (
    <Link
      to="/login"
      className="hv-cta"
      style={{
        textDecoration: 'none',
        padding: '9px 18px',
        fontSize: 13,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
      </svg>
      Ingresar
    </Link>
  );
}

function UsuarioChip() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!usuario) return null;

  const inicial = usuario.nombre[0]?.toUpperCase() ?? '?';

  return (
    <button
      onClick={() => {
        if (confirm(`¿Cerrar sesión de ${usuario.nombre}?`)) {
          logout();
          navigate('/login', { replace: true });
        }
      }}
      className="flex items-center gap-2.5 transition-all"
      style={{
        padding: '6px 10px 6px 6px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--hv-border)',
        boxShadow: 'var(--hv-inset-top)',
        cursor: 'pointer',
      }}
      title="Click para cerrar sesión"
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
    </button>
  );
}

function nombreRol(rol: string): string {
  switch (rol) {
    case 'productor':
      return 'Productor';
    case 'inversor':
      return 'Inversor';
    case 'acopio':
      return 'Acopio';
    case 'admin_plataforma':
      return 'Admin';
    default:
      return rol;
  }
}
