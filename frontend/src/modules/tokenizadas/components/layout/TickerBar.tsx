import { usePreciosLive, useHistoriaPrecios } from '../../hooks/usePreciosLive';
import { Sparkline } from '../charts/Sparkline';
import { porcentaje, usd } from '../../utils/format';
import type { Cultivo } from '../../services/mockPreciosService';

const NOMBRES: Record<Cultivo, string> = {
  soja: 'SOJA',
  maiz: 'MAÍZ',
  trigo: 'TRIGO',
  girasol: 'GIRASOL',
};

/**
 * Barra de tickers en tiempo real — estilo Binance / TradingView.
 * Se muestra fija arriba del layout de tokenizadas. Los precios fluctúan
 * cada 3–5s por MockPreciosService.
 */
export function TickerBar() {
  const ticks = usePreciosLive();

  return (
    <div className="border-y border-white/5 bg-black/40 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 text-[10px] font-medium text-white/40 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>PIZARRA · EN VIVO</span>
        </div>
        {ticks.map((tick) => (
          <TickerItem key={tick.cultivo} tick={tick} />
        ))}
      </div>
    </div>
  );
}

function TickerItem({ tick }: { tick: ReturnType<typeof usePreciosLive>[0] }) {
  const historia = useHistoriaPrecios(tick.cultivo, 30);
  const up = tick.cambio24hPct >= 0;

  return (
    <div className="flex items-center gap-3 shrink-0 group">
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-wider text-white/50 leading-none">
          {NOMBRES[tick.cultivo]}
        </span>
        <span className="tabular-nums text-sm font-semibold text-white leading-tight mt-0.5">
          {usd(tick.usdTn, 2)}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <Sparkline data={historia.map((h) => h.usdTn)} width={60} height={20} />
        <span
          className={`tabular-nums text-[10px] font-medium leading-none mt-0.5 ${
            up ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {porcentaje(tick.cambio24hPct, 2)}
        </span>
      </div>
    </div>
  );
}
