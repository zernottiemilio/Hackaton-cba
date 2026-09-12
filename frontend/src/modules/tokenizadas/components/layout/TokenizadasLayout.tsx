import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TokenizadasSidebar } from './TokenizadasSidebar';
import { TokenizadasTopbar } from './TokenizadasTopbar';
import { TickerBar } from './TickerBar';

/**
 * Layout dark-mode del módulo tokenizadas. Estética Binance / TradingView.
 * Convive con el shell del MVP sin romperlo: se activa solo en /tk/*.
 */
export function TokenizadasLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0A0C10] text-white/90 tk-scope">
      {/* Font tabular-nums para todos los números */}
      <style>{`
        .tk-scope { font-variant-numeric: tabular-nums; }
        .tk-scope .tabular-nums { font-variant-numeric: tabular-nums; }
        .tk-scope { --tk-up: #16C784; --tk-down: #EA3943; --tk-flat: #808A9D; }
        .tk-scope ::-webkit-scrollbar { width: 6px; height: 6px; }
        .tk-scope ::-webkit-scrollbar-track { background: transparent; }
        .tk-scope ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .tk-scope ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        .tk-scope .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
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
