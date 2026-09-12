import { NavLink } from 'react-router-dom';
import { useAuthStore, type RolPlataforma } from '@/stores/authStore';
import { HarvestLogo } from '../brand/HarvestLogo';
import { abreviarAddress } from '../../utils/format';

/** Program id del programa Anchor en devnet. Lo setea el frente Chain al deployar (VAL-10). */
const PROGRAM_ID: string = import.meta.env.VITE_SOLANA_PROGRAM_ID ?? '';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Roles que ven este ítem. `'todos'` = siempre visible (incluso sin auth). */
  roles: RolPlataforma[] | 'todos';
}

const ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: '◈', roles: 'todos' },
  // Público / inversor
  { to: '/invertir', label: 'Cosechas', icon: '◉', roles: 'todos' },
  { to: '/portfolio', label: 'Portfolio', icon: '▤', roles: ['inversor'] },
  // Productor
  { to: '/campanas', label: 'Mis emisiones', icon: '⛢', roles: ['productor'] },
  { to: '/campanas/nueva', label: 'Tokenizar lote', icon: '＋', roles: ['productor'] },
  { to: '/campos', label: 'Mis lotes', icon: '⛰', roles: ['productor'] },
  // Herramientas agronómicas (portadas del MVP hasta reestilar)
  { to: '/asistente', label: 'Asistente IA', icon: '✦', roles: ['productor', 'inversor'] },
  { to: '/alertas', label: 'Alertas', icon: '⚠', roles: ['productor'] },
  { to: '/clima', label: 'Clima', icon: '☁', roles: ['productor'] },
  { to: '/lluvias', label: 'Lluvias', icon: '☂', roles: ['productor'] },
  // Acopio
  { to: '/acopio', label: 'Tablero', icon: '⌂', roles: ['acopio'] },
  { to: '/acopio/recepcion', label: 'Recepción', icon: '⤵', roles: ['acopio'] },
  { to: '/acopio/posiciones', label: 'Posiciones', icon: '▤', roles: ['acopio'] },
  { to: '/acopio/liberaciones', label: 'Liberaciones', icon: '⤴', roles: ['acopio'] },
  // Admin
  { to: '/revision-emisiones', label: 'Cola de revisión', icon: '⚑', roles: ['admin_plataforma'] },
  { to: '/liquidacion', label: 'Liquidación', icon: '◎', roles: ['admin_plataforma'] },
  { to: '/comisiones', label: 'Comisiones', icon: '％', roles: ['admin_plataforma'] },
  { to: '/red-acopios', label: 'Red de acopios', icon: '☰', roles: ['admin_plataforma'] },
  { to: '/conciliacion', label: 'Conciliación', icon: '⊗', roles: ['admin_plataforma'] },
];

export function TokenizadasSidebar() {
  const usuario = useAuthStore((s) => s.usuario);
  const rol = usuario?.rolPlataforma ?? null;

  const items = ITEMS.filter((it) => {
    if (it.roles === 'todos') return true;
    if (!rol) return false; // sin sesión → solo se ven los "todos"
    return it.roles.includes(rol);
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
          Programa · devnet
        </div>
        {PROGRAM_ID ? (
          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="hv-mono"
            title={PROGRAM_ID}
            style={{ display: 'block', padding: '4px 4px 0', fontSize: 10, color: 'var(--hv-text-muted)', letterSpacing: '0.02em', textDecoration: 'none' }}
          >
            {abreviarAddress(PROGRAM_ID, 4, 4)} ↗
          </a>
        ) : (
          <div className="hv-mono" style={{ padding: '4px 4px 0', fontSize: 10, color: 'var(--hv-text-muted)' }}>
            sin configurar
          </div>
        )}
      </div>
    </aside>
  );
}
