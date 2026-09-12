import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TokenizadasSidebar } from './TokenizadasSidebar';
import { TokenizadasTopbar } from './TokenizadasTopbar';
import { HarvestFab } from './HarvestFab';
import { LandingPublicaPage } from '../../pages/LandingPublicaPage';
import { useAuthStore } from '@/stores/authStore';
import '../../styles/harvest-tokens.css';

/**
 * Shell del módulo Campañas Tokenizadas — identidad Harvest.fi.
 * Dark-first sobre fondo #06060a con acento verde #2BE06A.
 * Fuentes: Golos Text (display + UI) + JetBrains Mono (labels + números).
 * Los tokens visuales viven en `styles/harvest-tokens.css`.
 *
 * El layout marca `<html>` con la clase `tk-mounted` mientras esté montado
 * para que el fondo del body (heredado del MVP) no se cuele por debajo del
 * shell dark. Al desmontar (usuario vuelve a `/`), se limpia.
 *
 * Sin sesión: renderiza `LandingPublicaPage` full-screen sin sidebar ni
 * topbar. Cualquier URL bajo `/` (marketplace, ficha, productor) cae en
 * la landing hasta que el usuario ingrese. El CTA "Ingresar" de la
 * landing lleva a `/login`.
 */
export function TokenizadasLayout() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    document.documentElement.classList.add('tk-mounted');
    return () => {
      document.documentElement.classList.remove('tk-mounted');
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen tk-scope">
        <main className="min-h-screen overflow-y-auto p-6">
          <LandingPublicaPage />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen tk-scope overflow-hidden">
      <div className="flex h-screen">
        <TokenizadasSidebar />
        <div className="flex-1 min-w-0 flex flex-col h-screen">
          <TokenizadasTopbar />
          <main className="flex-1 min-h-0 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="p-6"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <HarvestFab />
    </div>
  );
}
