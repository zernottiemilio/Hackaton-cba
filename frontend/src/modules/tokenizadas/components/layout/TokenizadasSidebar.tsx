import { NavLink } from 'react-router-dom';
import { useWalletStore } from '../../stores/walletStore';
import type { ContextoTokenizacion } from '../../types/tokenizadas';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  contextos: ContextoTokenizacion[] | 'todos';
}

const ITEMS: NavItem[] = [
  { to: '/tk', label: 'Home', icon: '⌂', contextos: 'todos' },
  // Inversor
  { to: '/tk/invertir', label: 'Marketplace', icon: '⚡', contextos: ['inversor', 'productor', 'admin_plataforma'] },
  { to: '/tk/portfolio', label: 'Portfolio', icon: '◈', contextos: ['inversor'] },
  // Productor
  { to: '/tk/campanas', label: 'Mis campañas', icon: '⛢', contextos: ['productor'] },
  { to: '/tk/campanas/nueva', label: 'Nueva campaña', icon: '＋', contextos: ['productor'] },
  { to: '/tk/campos', label: 'Mis campos', icon: '⛰', contextos: ['productor'] },
  // Acopio
  { to: '/tk/acopio', label: 'Tablero', icon: '⌂', contextos: ['acopio'] },
  { to: '/tk/acopio/recepcion', label: 'Recepción', icon: '⤵', contextos: ['acopio'] },
  { to: '/tk/acopio/posiciones', label: 'Posiciones', icon: '▤', contextos: ['acopio'] },
  { to: '/tk/acopio/liberaciones', label: 'Liberaciones', icon: '⤴', contextos: ['acopio'] },
  // Admin
  { to: '/tk/admin/revision', label: 'Revisión', icon: '⚑', contextos: ['admin_plataforma'] },
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
    <aside className="w-56 shrink-0 bg-black/40 border-r border-white/5 flex flex-col">
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg">
            🌾
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-white text-sm font-semibold">AgroFácil</span>
            <span className="text-white/40 text-[10px] mt-1 uppercase tracking-wider">Tokenizadas</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/tk'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/90 hover:bg-white/5'
              }`
            }
          >
            <span className="text-lg leading-none w-5 text-center opacity-70">{it.icon}</span>
            <span className="font-medium">{it.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/5 p-3">
        <NavLink
          to="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 text-xs transition-colors"
        >
          <span>←</span>
          <span>Volver a AgroFácil</span>
        </NavLink>
      </div>
    </aside>
  );
}
