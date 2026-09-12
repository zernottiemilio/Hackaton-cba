import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TokenizadasSidebar } from './TokenizadasSidebar';
import { TokenizadasTopbar } from './TokenizadasTopbar';
import { TickerBar } from './TickerBar';
import '../../styles/harvest-tokens.css';

/**
 * Shell del módulo Campañas Tokenizadas — identidad Harvest.fi.
 * Dark-first sobre fondo #06060a con acento verde #2BE06A.
 * Fuentes: Golos Text (display + UI) + JetBrains Mono (labels + números).
 * Los tokens visuales viven en `styles/harvest-tokens.css`.
 */
export function TokenizadasLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen tk-scope">
      <TickerBar />
      <div className="flex min-h-[calc(100vh-40px)]">
        <TokenizadasSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TokenizadasTopbar />
          <main className="flex-1 overflow-y-auto">
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
    </div>
  );
}
