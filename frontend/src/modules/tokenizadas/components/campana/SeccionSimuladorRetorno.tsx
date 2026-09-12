import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { Tokenizacion } from '../../types/tokenizadas';
import { usd, porcentaje } from '../../utils/format';

/**
 * Simulador de retorno del inversor. Slider del precio esperado de la
 * commodity al momento de la liquidación → calcula payout por token, ROI
 * absoluto y % desde el precio del token (precio de fondeo con descuento).
 *
 * Base: 1 token = 1 tonelada. Payout on-chain = precio_liquidacion × tokens.
 * ROI vs precio del token, no vs pizarra — porque lo que "invierte" el
 * inversor es el precio con descuento.
 */
export function SeccionSimuladorRetorno({ t, cantidadInicial = 10 }: { t: Tokenizacion; cantidadInicial?: number }) {
  const precioToken = Number(t.precioTokenUsd);
  const precioReferencia = Number(t.precioReferenciaUsdTn);

  // Rango del slider: entre −25% y +40% de la pizarra actual.
  const minPrecio = Math.round(precioReferencia * 0.75);
  const maxPrecio = Math.round(precioReferencia * 1.4);

  const [precioLiquidacion, setPrecioLiquidacion] = useState<number>(precioReferencia);
  const [cantidad, setCantidad] = useState<number>(cantidadInicial);

  const sim = useMemo(() => {
    const inversion = cantidad * precioToken;
    const cobro = cantidad * precioLiquidacion;
    const retorno = cobro - inversion;
    const roi = inversion > 0 ? (retorno / inversion) * 100 : 0;
    return { inversion, cobro, retorno, roi };
  }, [cantidad, precioToken, precioLiquidacion]);

  const positivo = sim.retorno >= 0;
  const color = positivo ? 'var(--hv-green-text)' : 'var(--hv-red-text)';
  const gapPct = ((precioLiquidacion - precioReferencia) / precioReferencia) * 100;

  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: 'var(--hv-dato-strong, #6BB5E4)' }} />
            Simulador de retorno
          </h3>
          <p className="text-white/40 text-xs mt-1">
            Movés el precio de liquidación y la cantidad de toneladas para ver tu ROI.
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Cantidad */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="hv-label-sm" style={{ fontSize: 10 }}>Toneladas</span>
            <input
              type="number"
              value={cantidad}
              min={1}
              onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
              className="hv-mono"
              style={{
                width: 80,
                background: 'var(--hv-bg-input)',
                border: '1px solid var(--hv-border)',
                borderRadius: 6,
                color: 'var(--hv-text)',
                padding: '4px 8px',
                fontSize: 13,
                textAlign: 'right',
              }}
            />
          </div>
          <div className="flex gap-1.5">
            {[1, 10, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setCantidad(n)}
                className="hv-mono flex-1 py-1.5 rounded transition-colors"
                style={{
                  background: cantidad === n ? 'var(--hv-green-soft)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${cantidad === n ? 'rgba(43,224,106,0.28)' : 'var(--hv-border-subtle)'}`,
                  color: cantidad === n ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Precio de liquidación */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="hv-label-sm" style={{ fontSize: 10 }}>Precio liquidación (USD/tn)</span>
            <span className="hv-mono" style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600 }}>
              {usd(precioLiquidacion, 0)}
            </span>
          </div>
          <input
            type="range"
            min={minPrecio}
            max={maxPrecio}
            step={1}
            value={precioLiquidacion}
            onChange={(e) => setPrecioLiquidacion(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--hv-green)' }}
          />
          <div className="flex justify-between mt-1" style={{ color: 'var(--hv-text-muted)', fontSize: 10 }}>
            <span>{usd(minPrecio, 0)}</span>
            <span style={{ color: 'var(--hv-text-2)' }}>
              vs pizarra: {gapPct >= 0 ? '+' : ''}
              {gapPct.toFixed(1)}%
            </span>
            <span>{usd(maxPrecio, 0)}</span>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${positivo ? 'rgba(43,224,106,0.28)' : 'rgba(255,77,77,0.28)'}`,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <KpiSim label="Inversión" valor={usd(sim.inversion, 0)} />
        <KpiSim label="Cobrás" valor={usd(sim.cobro, 0)} />
        <KpiSim label="Retorno" valor={`${positivo ? '+' : ''}${usd(sim.retorno, 0)}`} color={color} />
        <KpiSim label="ROI" valor={porcentaje(sim.roi, 1)} color={color} />
      </div>

      <p style={{ color: 'var(--hv-text-muted)', fontSize: 11, marginTop: 12, lineHeight: 1.55 }}>
        Compra a <strong style={{ color: 'var(--hv-text-2)' }}>{usd(precioToken, 2)}/tn</strong> (fondeo con
        descuento) y cobrás lo que fije el acopio en la liquidación. Es una estimación —
        el precio real se declara al momento de la cosecha.
      </p>
    </div>
  );
}

function KpiSim({ label, valor, color }: { label: string; valor: string; color?: string }) {
  return (
    <div>
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div
        className="hv-mono"
        style={{
          color: color ?? 'var(--hv-text)',
          fontSize: 17,
          fontWeight: 600,
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {valor}
      </div>
    </div>
  );
}
