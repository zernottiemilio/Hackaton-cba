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
 * Barra de tickers en tiempo real — Harvest.fi feel.
 * Oráculo público de precios de pizarra actualizando cada 3-5s.
 */
export function TickerBar() {
  const ticks = usePreciosLive();

  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'rgba(6,6,10,0.85)',
        borderTop: '1px solid var(--hv-border-subtle)',
        borderBottom: '1px solid var(--hv-border-subtle)',
      }}
    >
      <div className="flex items-center gap-8 px-6 py-2 overflow-x-auto scrollbar-none">
        <div
          className="flex items-center gap-2 shrink-0"
          style={{
            fontFamily: 'var(--hv-font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--hv-text-dim)',
            fontWeight: 500,
          }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'var(--hv-green)' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: 'var(--hv-green)' }}
            />
          </span>
          <span>Oráculo · Pizarra Rosario</span>
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
        <span
          style={{
            fontFamily: 'var(--hv-font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--hv-text-dim)',
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {NOMBRES[tick.cultivo]}
        </span>
        <span
          style={{
            color: 'var(--hv-text)',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.15,
            marginTop: 2,
            fontFamily: 'var(--hv-font-mono)',
          }}
        >
          {usd(tick.usdTn, 2)}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <Sparkline data={historia.map((h) => h.usdTn)} width={60} height={20} />
        <span
          style={{
            fontFamily: 'var(--hv-font-mono)',
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            marginTop: 2,
            color: up ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
          }}
        >
          {porcentaje(tick.cambio24hPct, 2)}
        </span>
      </div>
    </div>
  );
}
