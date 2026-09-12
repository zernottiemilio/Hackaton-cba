import { useMemo } from 'react';
import { Sparkline } from '../charts/Sparkline';
import { useHistoriaPrecios } from '../../hooks/usePreciosLive';
import { usd, usdCompacto, porcentaje } from '../../utils/format';
import type { FuentePrecio } from '../../types/tokenizadas';
import type { Cultivo } from '../../services/mockPreciosService';

interface Props {
  cultivo: Cultivo;
  fuentePrecio: FuentePrecio;
  precioReferenciaUsdTn: number;
  descuentoPct: number;
  toneladasOfrecidas: number;
  precioDinamico: boolean;
  precioPisoUsd: number | null;
  fondeoDesde: string;
  fondeoHasta: string;
  onFuenteCambia: (f: FuentePrecio) => void;
  onPrecioReferenciaCambia: (v: number) => void;
  onDescuentoCambia: (v: number) => void;
  onPrecioDinamicoCambia: (v: boolean) => void;
  onPrecioPisoCambia: (v: number | null) => void;
  onFondeoDesdeCambia: (v: string) => void;
  onFondeoHastaCambia: (v: string) => void;
}

/**
 * Paso 3 del wizard: cotización.
 * Referencia → descuento → precio del HRV → recaudación → tasa implícita.
 * La última fila (tasa implícita en USD anual) es la que cierra la venta interna:
 * el productor no piensa en "descuento" — piensa en "a qué tasa me financio".
 */
export function CalculadoraCotizacion(p: Props) {
  const historia = useHistoriaPrecios(p.cultivo, 60);
  const precioToken = p.precioReferenciaUsdTn * (1 - p.descuentoPct / 100);
  const totalRecaudado = precioToken * p.toneladasOfrecidas;
  const costoFinanciamientoUsd = p.precioReferenciaUsdTn * p.toneladasOfrecidas - totalRecaudado;

  // Días entre fondeo y cosecha aproximados por fondeo (proxy simple).
  const dias = useMemo(() => {
    if (!p.fondeoDesde || !p.fondeoHasta) return 180;
    const desde = new Date(p.fondeoDesde).getTime();
    const hasta = new Date(p.fondeoHasta).getTime();
    return Math.max(30, Math.floor((hasta - desde) / (24 * 3600 * 1000)) + 180);
  }, [p.fondeoDesde, p.fondeoHasta]);

  // Tasa implícita en USD anualizada.
  const tasaAnualPct = totalRecaudado > 0 ? (costoFinanciamientoUsd / totalRecaudado) * (365 / dias) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Fuente de precio + tabs */}
      <div className="hv-glass" style={{ borderRadius: 16, padding: 18 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="hv-label" style={{ fontSize: 10 }}>Fuente del precio de referencia</div>
          {p.fuentePrecio !== 'manual' && (
            <span className="hv-chip hv-chip-green" style={{ fontSize: 10 }}>
              <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
              oráculo activo
            </span>
          )}
        </div>
        <div className="flex gap-1 mb-4" style={{ background: 'var(--hv-bg-input)', border: '1px solid var(--hv-border)', borderRadius: 10, padding: 4 }}>
          {(['pizarra_rosario', 'matba_futuro', 'manual'] as FuentePrecio[]).map((f) => (
            <button
              key={f}
              onClick={() => p.onFuenteCambia(f)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 8,
                border: 'none',
                fontSize: 12,
                fontFamily: 'var(--hv-font-mono)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                background: p.fuentePrecio === f ? 'var(--hv-green-soft)' : 'transparent',
                color: p.fuentePrecio === f ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
              }}
            >
              {f === 'pizarra_rosario' ? 'Pizarra' : f === 'matba_futuro' ? 'MATBA' : 'Manual'}
            </button>
          ))}
        </div>

        {/* Precio con sparkline */}
        <div className="flex items-end justify-between">
          <div>
            <div className="hv-label-sm" style={{ fontSize: 9 }}>Precio de referencia · USD/t</div>
            <input
              type="number"
              value={p.precioReferenciaUsdTn || ''}
              onChange={(e) => p.onPrecioReferenciaCambia(Number(e.target.value) || 0)}
              disabled={p.fuentePrecio !== 'manual'}
              className="hv-mono"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--hv-text)',
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                outline: 'none',
                marginTop: 2,
                padding: 0,
                width: 180,
              }}
            />
          </div>
          <Sparkline data={historia.map((h) => h.usdTn)} width={180} height={44} strokeWidth={2} />
        </div>
      </div>

      {/* Slider de descuento */}
      <div className="hv-glass" style={{ borderRadius: 16, padding: 20 }}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="hv-label" style={{ fontSize: 10 }}>Descuento sobre pizarra</div>
            <p style={{ fontSize: 11, color: 'var(--hv-text-muted)', marginTop: 3 }}>
              Cuanto cedés vs. vender al precio de mercado. Mayor descuento = fondeo más rápido.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="hv-mono" style={{ fontSize: 28, fontWeight: 600, color: 'var(--hv-green-text)' }}>
              {p.descuentoPct.toFixed(0)}%
            </div>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={p.descuentoPct}
          onChange={(e) => p.onDescuentoCambia(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--hv-green)' }}
        />
        <div className="flex justify-between hv-label-sm" style={{ marginTop: 6, fontSize: 9 }}>
          <span>0%</span>
          <span>10%</span>
          <span>20%</span>
        </div>
      </div>

      {/* Cotización dinámica */}
      <div className="hv-glass" style={{ borderRadius: 16, padding: 18 }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 14 }}>Cotización dinámica</div>
            <p style={{ fontSize: 12, color: 'var(--hv-text-muted)', marginTop: 3, maxWidth: 400 }}>
              El precio del HRV sigue la pizarra durante el fondeo.{' '}
              <strong style={{ color: 'var(--hv-text-2)' }}>Las tenencias ya vendidas nunca cambian de precio.</strong>
            </p>
          </div>
          <ToggleSwitch value={p.precioDinamico} onChange={p.onPrecioDinamicoCambia} />
        </div>
        {p.precioDinamico && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
            <div className="hv-label-sm" style={{ fontSize: 10, marginBottom: 6 }}>Piso mínimo USD/t</div>
            <input
              type="number"
              value={p.precioPisoUsd ?? ''}
              placeholder="Ej: 280"
              onChange={(e) => p.onPrecioPisoCambia(e.target.value ? Number(e.target.value) : null)}
              className="hv-mono"
              style={{
                background: 'var(--hv-bg-input)',
                border: '1px solid var(--hv-border)',
                color: 'var(--hv-text)',
                fontSize: 15,
                padding: '10px 14px',
                borderRadius: 10,
                width: 180,
              }}
            />
          </div>
        )}
      </div>

      {/* Ventana de fondeo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="hv-glass" style={{ borderRadius: 12, padding: 14 }}>
          <div className="hv-label-sm" style={{ fontSize: 10, marginBottom: 6 }}>Fondeo desde</div>
          <input
            type="datetime-local"
            value={p.fondeoDesde}
            onChange={(e) => p.onFondeoDesdeCambia(e.target.value)}
            style={{
              background: 'var(--hv-bg-input)',
              border: '1px solid var(--hv-border)',
              color: 'var(--hv-text)',
              fontSize: 14,
              padding: '9px 12px',
              borderRadius: 8,
              width: '100%',
            }}
          />
        </div>
        <div className="hv-glass" style={{ borderRadius: 12, padding: 14 }}>
          <div className="hv-label-sm" style={{ fontSize: 10, marginBottom: 6 }}>Fondeo hasta</div>
          <input
            type="datetime-local"
            value={p.fondeoHasta}
            onChange={(e) => p.onFondeoHastaCambia(e.target.value)}
            style={{
              background: 'var(--hv-bg-input)',
              border: '1px solid var(--hv-border)',
              color: 'var(--hv-text)',
              fontSize: 14,
              padding: '9px 12px',
              borderRadius: 8,
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Resumen de la oferta */}
      <div
        style={{
          borderRadius: 16,
          padding: 24,
          background: 'linear-gradient(180deg, rgba(43,224,106,0.08) 0%, rgba(43,224,106,0.02) 100%)',
          border: '1px solid rgba(43,224,106,0.22)',
          boxShadow: 'var(--hv-inset-top)',
        }}
      >
        <div className="hv-label" style={{ fontSize: 10, color: 'var(--hv-green-text)', marginBottom: 12 }}>
          Cotización resultante
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <ResumenRow label="Precio de referencia" value={usd(p.precioReferenciaUsdTn, 2)} sub="USD por tn" />
          <ResumenRow label="Descuento" value={porcentaje(-p.descuentoPct, 1)} accent="green" />
          <ResumenRow label="Precio por HRV" value={usd(precioToken, 2)} destacado />
          <ResumenRow label="HRV a emitir" value={p.toneladasOfrecidas.toLocaleString('es-AR', { maximumFractionDigits: 0 })} sub="1 HRV = 1 tn" />
          <ResumenRow label="Vas a recibir hoy" value={usdCompacto(totalRecaudado)} destacado sub="USDC en tu wallet" />
          <ResumenRow
            label="Costo del financiamiento"
            value={`${usdCompacto(costoFinanciamientoUsd)} · ${tasaAnualPct.toFixed(1)}% anual`}
            accent={tasaAnualPct > 25 ? 'amber' : 'muted'}
          />
        </div>
      </div>
    </div>
  );
}

function ResumenRow({
  label,
  value,
  sub,
  destacado,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  destacado?: boolean;
  accent?: 'green' | 'amber' | 'muted';
}) {
  const color =
    accent === 'green' ? 'var(--hv-green-text)' :
    accent === 'amber' ? 'var(--hv-amber-text)' :
    accent === 'muted' ? 'var(--hv-text-2)' :
    'var(--hv-text)';
  return (
    <div className="flex justify-between items-baseline gap-3">
      <div>
        <div style={{ color: 'var(--hv-text-2)', fontSize: 12 }}>{label}</div>
        {sub && <div className="hv-label-sm" style={{ fontSize: 9, marginTop: 2 }}>{sub}</div>}
      </div>
      <span
        className="hv-mono"
        style={{
          color,
          fontSize: destacado ? 18 : 14,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        position: 'relative',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: value ? 'var(--hv-green)' : 'rgba(255,255,255,0.10)',
        boxShadow: value ? '0 0 16px rgba(43,224,106,0.35)' : 'none',
      }}
      aria-pressed={value}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 23 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fafafa',
          transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </button>
  );
}
