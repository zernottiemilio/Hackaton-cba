import { useState } from 'react';
import { Drawer } from 'vaul';
import { NavLink } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { navItems } from '@/constants/navigation';
import { LogoLockup } from './Logo';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          aria-label="Menú"
          className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg bg-surface border border-border shadow-sm"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl shadow-lift focus:outline-none">
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted" />
          <Drawer.Title className="sr-only">Menú de AgroFácil</Drawer.Title>

          <div className="px-5 pt-4 pb-3">
            <LogoLockup size={24} />
            <p className="text-xs text-muted-foreground mt-1.5">{usuario?.nombre}</p>
          </div>

          <nav className="px-3 pb-2 max-h-[60vh] overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg text-sm',
                    isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted',
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-border p-3">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>

          <div className="pb-[env(safe-area-inset-bottom)]" />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
