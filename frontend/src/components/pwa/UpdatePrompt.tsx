import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';

/**
 * Detecta cuando hay una versión nueva de la PWA disponible (gracias al SW
 * que registramos en registerType: 'prompt') y muestra un toast pidiéndole
 * al usuario que recargue para tomarla.
 *
 * Cuando el productor está offline, esStaleeable es false → no aparece.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [actualizar, setActualizar] = useState<(() => Promise<void>) | null>(null);
  const { online, cantidadPendientes } = useOfflineSync();

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegistered(reg: ServiceWorkerRegistration | undefined) {
        // Chequear actualizaciones cada hora mientras la app está abierta
        if (reg) {
          setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
        }
      },
    });
    setActualizar(() => () => update(true));
  }, []);

  // No mostramos el prompt si está offline o tiene operaciones pendientes:
  // recargar en ese momento puede dejar al usuario con un loading interminable
  // y/o perder progreso (cache vieja vs nueva).
  const puedeActualizar = needRefresh && online && cantidadPendientes === 0;

  return (
    <AnimatePresence>
      {puedeActualizar && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md"
        >
          <div className="glass rounded-2xl shadow-lift p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Hay una versión nueva</p>
              <p className="text-xs text-muted-foreground">Recargá para actualizar.</p>
            </div>
            <Button size="sm" onClick={() => actualizar?.()}>
              Recargar
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
