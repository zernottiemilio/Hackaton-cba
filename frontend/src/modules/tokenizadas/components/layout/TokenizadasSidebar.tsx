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
  { to: '/', label: 'Inicio', icon: '◈', contextos: 'todos' },
  // Inversor
  { to: '/invertir', label: 'Marketplace', icon: '⚡', contextos: ['inversor', 'productor', 'admin_plataforma'] },
  { to: '/portfolio', label: 'Portfolio', icon: '▤', contextos: ['inversor'] },
  // Productor
  { to: '/campanas', label: 'Mis emisiones', icon: '⛢', contextos: ['productor'] },
  { to: '/campanas/nueva', label: 'Tokenizar lote', icon: '＋', contextos: ['productor'] },
  { to: '/campos', label: 'Mis lotes', icon: '⛰', contextos: ['productor'] },
  // Acopio
  { to: '/acopio', label: 'Tablero', icon: '⌂', contextos: ['acopio'] },
  { to: '/acopio/recepcion', label: 'Recepción', icon: '⤵', contextos: ['acopio'] },
  { to: '/acopio/posiciones', label: 'Posiciones', icon: '▤', contextos: ['acopio'] },
  { to: '/acopio/liberaciones', label: 'Liberaciones', icon: '⤴', contextos: ['acopio'] },
  // Admin
  { to: '/revision-emisiones', label: 'Cola de revisión', icon: '⚑', contextos: ['admin_plataforma'] },
  { to: '/red-acopios', label: 'Red de acopios', icon: '☰', contextos: ['admin_plataforma'] },
  { to: '/conciliacion', label: 'Conciliación', icon: '⊗', contextos: ['admin_plataforma'] },
];

export function TokenizadasSidebar() {
  const contexto = useWalletStore((s) => s.contextoActivo);

  const items = ITEMS.filter((it) => {
    if (it.contextos === 'todos') return true;
    if (!contexto) return it.to === '/' || it.to === '/invertir';
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
            end={it.to === '/'}
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
        <div className="hv-label-sm" style={{ padding: '0 4px 4px', fontSize: 10 }}>
          Contrato · devnet
        </div>
        <div
          className="hv-mono"
          style={{ padding: '4px 4px 0', fontSize: 10, color: 'var(--hv-text-muted)', letterSpacing: '0.02em', wordBreak: 'break-all' }}
        >
          8pM3…zP1
        </div>
      </div>
    </aside>
  );
}
