import { useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Search } from 'lucide-react';
import { navItems } from '@/constants/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useCommandPalette } from '@/stores/commandPaletteStore';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const toggle = useCommandPalette((s) => s.toggle);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle]);

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="relative w-full max-w-xl mx-4"
          >
            <Command className="glass rounded-2xl shadow-lift overflow-hidden border border-border">
              <div className="flex items-center gap-3 px-4 border-b border-border/60">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  placeholder="Buscar módulo, acción…"
                  className="flex-1 h-12 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
                <kbd className="text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">esc</kbd>
              </div>
              <Command.List className="max-h-[340px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  Sin resultados.
                </Command.Empty>

                <Command.Group heading="Ir a" className="text-xs text-muted-foreground px-2 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                  {navItems.map((item) => (
                    <Command.Item
                      key={item.to}
                      value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                      onSelect={() => run(() => navigate(item.to))}
                      className={cn(
                        'flex items-center gap-3 px-2 py-2 rounded-md text-sm cursor-pointer',
                        'aria-selected:bg-primary/10 aria-selected:text-primary',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Separator className="my-2 border-t border-border/60" />

                <Command.Group heading="Cuenta">
                  <Command.Item
                    value="cerrar sesion salir logout"
                    onSelect={() => run(() => { logout(); navigate('/login'); })}
                    className="flex items-center gap-3 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-destructive/10 aria-selected:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar sesión</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>
              <div className="border-t border-border/60 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>↑↓ navegar · ↵ ejecutar</span>
                <kbd className="bg-muted/60 px-1.5 py-0.5 rounded">⌘K</kbd>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
