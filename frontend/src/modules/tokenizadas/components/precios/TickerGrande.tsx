import { useHistoriaPrecios } from '../../hooks/usePreciosLive';
import { Sparkline } from '../charts/Sparkline';
import { usd, porcentaje } from '../../utils/format';
import type { Cultivo } from '../../services/preciosService';

const NOMBRES: Record<Cultivo, string> = {
  soja: 'Soja',
  maiz: 'Maíz',
  trigo: 'Trigo',
  girasol: 'Girasol',
};

/**
 * Card grande de cotización de un grano. Muestra precio USD/tn, cambio
 * vs rueda anterior y sparkline de 40 días. Se usa en la home pública
 * (`HomePage`) y en la home del inversor (`HomeInversorPage`).
 *
 * Los datos vienen del backend `/precios/pizarra` — pizarra Rosario real
 * de granos.ar (BCR / Consiagro).
 */
export function TickerGrande({
  cultivo,
  usdTn,
  cambio,
}: {
  cultivo: Cultivo;
  usdTn: number;
  cambio: number;
}) {
  const historia = useHistoriaPrecios(cultivo, 40);
  const nombre = NOMBRES[cultivo];
  const up = cambio >= 0;

  return (
    <div
      className="hv-glass"
      style={{
        borderRadius: 16,
        padding: 20,
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 14 }}>{nombre}</span>
        <span className="hv-label-sm" style={{ fontSize: 10 }}>USD/T</span>
      </div>
      <div
        className="hv-mono"
        style={{ fontSize: 26, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em', lineHeight: 1 }}
      >
        {usd(usdTn, 2)}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span
          className="hv-mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: up ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
          }}
        >
          {porcentaje(cambio, 2)}
        </span>
        <Sparkline data={historia.map((h) => h.usdTn)} width={80} height={24} />
      </div>
    </div>
  );
}
