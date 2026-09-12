import { NavLink } from 'react-router-dom';
import { useWalletStore } from '../../stores/walletStore';
import type { ContextoTokenizacion } from '../../types/tokenizadas';
import { HarvestLogo } from '../brand/HarvestLogo';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  contextos: ContextoTokenizacion[] | 'todos';
}

const ITEMS: NavItem[] = [
  { to: '/tk', label: 'Inicio', icon: '◈', contextos: 'todos' },
  // Inversor
  { to: '/tk/invertir', label: 'Marketplace', icon: '⚡', contextos: ['inversor', 'productor', 'admin_plataforma'] },
  { to: '/tk/portfolio', label: 'Portfolio', icon: '▤', contextos: ['inversor'] },
  // Productor
  { to: '/tk/campanas', label: 'Mis emisiones', icon: '⛢', contextos: ['productor'] },
  { to: '/tk/campanas/nueva', label: 'Tokenizar lote', icon: '＋', contextos: ['productor'] },
  { to: '/tk/campos', label: 'Mis lotes', icon: '⛰', contextos: ['productor'] },
  // Acopio
  { to: '/tk/acopio', label: 'Tablero', icon: '⌂', contextos: ['acopio'] },
  { to: '/tk/acopio/recepcion', label: 'Recepción', icon: '⤵', contextos: ['acopio'] },
  { to: '/tk/acopio/posiciones', label: 'Posiciones', icon: '▤', contextos: ['acopio'] },
  { to: '/tk/acopio/liberaciones', label: 'Liberaciones', icon: '⤴', contextos: ['acopio'] },
  // Admin
  { to: '/tk/admin/revision', label: 'Cola de revisión', icon: '⚑', contextos: ['admin_plataforma'] },
  { to: '/tk/admin/acopios', label: 'Red de acopios', icon: '☰', contextos: ['admin_plataforma'] },
  { to: '/tk/admin/conciliacion', label: 'Conciliación', icon: '⊗', contextos: ['admin_plataforma'] },
];

export function TokenizadasSidebar() {
  const contexto = useWalletStore((s) => s.contextoActivo);

  const items = ITEMS.filter((it) => {
    if (it.contextos === 'todos') return true;
    if (!contexto) return it.to === '/tk' || it.to === '/tk/invertir';
    return it.contextos.includes(contexto);
  });

  return (
    <aside
      className="w-60 shrink-0 flex flex-col"
      style={{ background: 'rgba(11, 13, 17, 0.65)', borderRight: '1px solid var(--hv-border)' }}
    >
      <div
        className="px-5 py-5"
        style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}
      >
        <HarvestLogo variant="lockup" size={36} animated tagline />
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/tk'}
            className={({ isActive }) => `hv-nav-item ${isActive ? 'is-active' : ''}`}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? 'var(--hv-text)' : 'var(--hv-text-2)',
              background: isActive ? 'rgba(43,224,106,0.10)' : 'transparent',
              border: isActive ? '1px solid rgba(43,224,106,0.22)' : '1px solid transparent',
              transition: 'all 120ms cubic-bezier(0.4, 0, 0.2, 1)',
            })}
          >
            <span
              style={{
                width: 20,
                textAlign: 'center',
                fontSize: 16,
                lineHeight: 1,
                opacity: 0.85,
              }}
            >
              {it.icon}
            </span>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <div
          className="hv-label-sm"
          style={{ padding: '0 4px 6px', fontSize: 10 }}
        >
          Contrato · devnet
        </div>
        <NavLink
          to="/"
          className="hv-nav-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--hv-text-muted)',
            textDecoration: 'none',
          }}
        >
          <span>←</span>
          <span>Volver a AgroFácil</span>
        </NavLink>
      </div>
    </aside>
  );
}
