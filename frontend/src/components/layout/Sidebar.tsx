import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Search } from 'lucide-react';
import { navItems } from '@/constants/navigation';
import { LogoLockup } from './Logo';
import { useAuthStore } from '@/stores/authStore';
import { useCommandPalette } from '@/stores/commandPaletteStore';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const openPalette = useCommandPalette((s) => s.setOpen);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 flex-col p-4">
      <div className="relative flex-1 flex flex-col glass-green rounded-2xl shadow-glass overflow-hidden">
        {/* Brand */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <LogoLockup size={30} variant="light" animated />
        </div>

        {/* Cuenta info */}
        <div className="px-5 pb-4 border-b border-white/15 shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-white/60 font-medium">Cuenta</p>
          <p className="text-sm text-white font-medium truncate">{usuario?.nombre}</p>
        </div>

        {/* Nav — toma todo el espacio disponible */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 inset-y-1.5 w-1 bg-white rounded-r-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer — siempre pegado abajo */}
        <div className="p-3 border-t border-white/15 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => openPalette(true)}
            className="w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-between text-left transition"
          >
            <span className="flex items-center gap-2 text-[11px] text-white/85">
              <Search className="h-3.5 w-3.5" />
              Búsqueda rápida
            </span>
            <kbd className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/75 hover:bg-white/10 hover:text-white transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
