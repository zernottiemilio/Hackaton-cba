import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, Plus, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';
import {
  esSafariIos,
  esStandalone,
  fueDismissedRecientemente,
  marcarDismissed,
} from '@/utils/pwa';

/** Evento beforeinstallprompt — Chrome / Edge Android / Windows */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Componente que invita al productor a instalar la PWA.
 * - Android (Chrome): captura el beforeinstallprompt y muestra un banner
 *   con un botón "Instalar" que dispara el prompt nativo del browser.
 * - iOS (Safari): no hay prompt programático, mostramos un mini tutorial
 *   visual con flechas → Compartir → Agregar a inicio.
 * - Si la app ya está instalada (display-mode: standalone), no muestra nada.
 * - Si el usuario lo cierra con X, no vuelve a aparecer por 7 días.
 */
export function InstallPrompt() {
  const [androidEvent, setAndroidEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosTutorialAbierto, setIosTutorialAbierto] = useState(false);
  const [androidVisible, setAndroidVisible] = useState(false);

  useEffect(() => {
    if (esStandalone()) return;
    if (fueDismissedRecientemente()) return;

    // ===== Android / desktop Chrome =====
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setAndroidEvent(e as BeforeInstallPromptEvent);
      // Mostrar el banner después de 5s para no interrumpir el primer load
      setTimeout(() => setAndroidVisible(true), 5000);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // ===== iOS Safari =====
    if (esSafariIos()) {
      setTimeout(() => setIosOpen(true), 8000);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const cerrarIos = () => {
    marcarDismissed();
    setIosOpen(false);
    setIosTutorialAbierto(false);
  };

  const cerrarAndroid = () => {
    marcarDismissed();
    setAndroidVisible(false);
  };

  const instalarAndroid = async () => {
    if (!androidEvent) return;
    await androidEvent.prompt();
    const choice = await androidEvent.userChoice;
    setAndroidEvent(null);
    setAndroidVisible(false);
    if (choice.outcome === 'dismissed') marcarDismissed();
  };

  return (
    <>
      {/* Android — banner inferior */}
      <AnimatePresence>
        {androidVisible && androidEvent && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 z-40 lg:left-auto lg:right-4 lg:max-w-sm"
          >
            <div className="glass rounded-2xl shadow-lift p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Logo size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Instalá AgroFácil</p>
                <p className="text-xs text-muted-foreground">Acceso rápido desde tu home, funciona offline.</p>
              </div>
              <Button size="sm" onClick={instalarAndroid}>
                <Download className="h-3.5 w-3.5" />
                Instalar
              </Button>
              <button
                onClick={cerrarAndroid}
                aria-label="Cerrar"
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS — banner que abre un tutorial visual */}
      <AnimatePresence>
        {iosOpen && !iosTutorialAbierto && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 z-40"
          >
            <div className="glass rounded-2xl shadow-lift p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Logo size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Instalá AgroFácil</p>
                <p className="text-xs text-muted-foreground">Como app en tu iPhone — 2 toques.</p>
              </div>
              <Button size="sm" onClick={() => setIosTutorialAbierto(true)}>
                Cómo
              </Button>
              <button
                onClick={cerrarIos}
                aria-label="Cerrar"
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS — overlay con instrucciones */}
      <AnimatePresence>
        {iosTutorialAbierto && (
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cerrarIos}
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="relative pointer-events-auto bg-surface w-full rounded-t-2xl shadow-lift max-w-md mx-4 mb-0 p-6"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-6 w-6 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Instalá AgroFácil</h2>
                </div>
                <button
                  onClick={cerrarIos}
                  aria-label="Cerrar"
                  className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-5">Asegurate de estar en Safari (no funciona en Chrome para iOS).</p>

              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">1</span>
                  <div>
                    <p className="text-sm text-foreground">
                      Tocá el botón <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-muted mx-1"><Share className="h-3.5 w-3.5 text-primary" /></span> <strong>Compartir</strong> en la barra inferior de Safari.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">2</span>
                  <div>
                    <p className="text-sm text-foreground">
                      Bajá y elegí <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted mx-0.5 text-xs font-medium"><Plus className="h-3 w-3" />Agregar a inicio</span>.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">3</span>
                  <div>
                    <p className="text-sm text-foreground">
                      Confirmá <strong>Agregar</strong>. Vas a ver el ícono verde en tu home como cualquier otra app.
                    </p>
                  </div>
                </li>
              </ol>

              <Button onClick={cerrarIos} variant="outline" className="w-full mt-6">
                Entendido
              </Button>

              <div className="pb-[env(safe-area-inset-bottom)]" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
