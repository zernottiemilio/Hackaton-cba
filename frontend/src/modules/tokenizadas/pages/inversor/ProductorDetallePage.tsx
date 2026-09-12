import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productoresApi } from '../../services/productoresService';
import { usePrecioLive } from '../../hooks/usePreciosLive';
import { EstadoCampanaBadge } from '../../components/campana/EstadoCampanaBadge';
import { BadgeModo } from '../../components/campana/BadgeModo';
import { BarraFondeo } from '../../components/campana/BarraFondeo';
import { Rating } from './HomeInversorPage';
import { usd, usdCompacto, toneladas, hectareas, fecha, diasRestantes, porcentaje } from '../../utils/format';
import type { Cultivo } from '../../services/mockPreciosService';

/**
 * Detalle de un productor + trazabilidad histórica.
 * Muestra su rating, campañas activas y liquidadas, y la serie histórica
 * 90d de cotización por cultivo (comparada contra el precio del token
 * al momento de la emisión — para que el inversor vea si "compró barato").
 */
export function ProductorDetallePage() {
  const { id = '' } = useParams();
  const { data: p, isLoading } = useQuery({
    queryKey: ['tk', 'productor', id],
    queryFn: () => productoresApi.detalle(id),
    enabled: !!id,
  });

  const [cultivoSel, setCultivoSel] = useState<string | null>(null);

  const cultivosDisponibles = useMemo(() => {
    if (!p) return [];
    return Object.keys(p.trazabilidad ?? {});
  }, [p]);

  const cultivoActivo = cultivoSel ?? cultivosDisponibles[0];

  if (isLoading || !p) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center" style={{ color: 'var(--hv-text-muted)' }}>
        Cargando productor...
      </div>
    );
  }

  const activas = p.tokenizaciones.filter(
    (t) => t.campania.estadoToken === 'abierta' || t.campania.estadoToken === 'en_curso' || t.campania.estadoToken === 'en_cosecha',
  );
  const historicas = p.tokenizaciones.filter((t) => t.campania.estadoToken === 'liquidada');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Link
        to="/tk"
        style={{ color: 'var(--hv-text-muted)', fontSize: 12, display: 'inline-flex', gap: 6, textDecoration: 'none' }}
      >
        ← Volver a inicio
      </Link>

      {/* Hero del productor */}
      <section
        className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6"
        style={{
          background: 'linear-gradient(180deg, rgba(43,224,106,0.06) 0%, rgba(43,224,106,0.02) 100%)',
          border: '1px solid rgba(43,224,106,0.22)',
          borderRadius: 20,
          padding: 24,
          boxShadow: 'var(--hv-inset-top)',
        }}
      >
        <div>
          <div className="hv-label" style={{ fontSize: 10 }}>Perfil de productor</div>
          <div className="flex items-center gap-4 mt-3">
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--hv-green-deep), var(--hv-green-mid))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--hv-bg-token)',
                fontWeight: 700,
                fontSize: 24,
              }}
            >
              {p.nombre[0]}
            </div>
            <div>
              <h1 style={{ color: 'var(--hv-text)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }}>
                {p.nombre}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <Rating value={p.rating} size={14} />
                {p.provincia && (
                  <span className="hv-label-sm" style={{ fontSize: 10 }}>
                    · {p.provincia}
                  </span>
                )}
              </div>
            </div>
          </div>
          {p.walletAddress && (
            <div
              className="hv-mono"
              style={{ fontSize: 11, color: 'var(--hv-text-muted)', marginTop: 12, wordBreak: 'break-all' }}
            >
              {p.walletAddress}
            </div>
          )}
        </div>

        {/* Métricas del productor */}
        <div className="grid grid-cols-2 gap-3" style={{ minWidth: 320 }}>
          <MetricaProductor label="Activas" value={p.metricas.campaniasActivas.toString()} />
          <MetricaProductor label="Liquidadas" value={p.metricas.campaniasLiquidadas.toString()} />
          <MetricaProductor label="Bajo admin" value={toneladas(p.metricas.toneladasBajoAdmin, 0)} />
          <MetricaProductor
            label="Volumen"
            value={usdCompacto(p.metricas.usdRecaudadoTotal)}
            accent
          />
        </div>
      </section>

      {/* Trazabilidad de cotización */}
      {cultivosDisponibles.length > 0 && cultivoActivo && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
                Trazabilidad de cotización
              </h2>
              <p className="hv-label-sm" style={{ marginTop: 4 }}>
                Precio de pizarra últimos 90d + emisiones sobre esta serie
              </p>
            </div>
            {cultivosDisponibles.length > 1 && (
              <div
                className="flex gap-1"
                style={{
                  background: 'var(--hv-bg-input)',
                  border: '1px solid var(--hv-border)',
                  borderRadius: 10,
                  padding: 4,
                }}
              >
                {cultivosDisponibles.map((c) => {
                  const activo = c === cultivoActivo;
                  return (
                    <button
                      key={c}
                      onClick={() => setCultivoSel(c)}
                      className="hv-mono"
                      style={{
                        padding: '5px 10px',
                        borderRadius: 7,
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        background: activo ? 'var(--hv-green-soft)' : 'transparent',
                        color: activo ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <GraficoTrazabilidad
            cultivo={cultivoActivo as Cultivo}
            serie={p.trazabilidad[cultivoActivo] ?? []}
            emisiones={p.tokenizaciones.filter((t) => t.campania.cultivo?.nombre === cultivoActivo)}
          />
        </section>
      )}

      {/* Campañas activas */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
            Emisiones activas
          </h2>
          <span className="hv-label-sm" style={{ fontSize: 11 }}>
            {activas.length} abiertas para invertir
          </span>
        </div>
        {activas.length === 0 ? (
          <div className="hv-glass" style={{ borderRadius: 14, padding: 24, textAlign: 'center', color: 'var(--hv-text-muted)', fontSize: 13 }}>
            Este productor no tiene emisiones activas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activas.map((t) => (
              <CardCampaniaCompacta key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      {/* Histórico */}
      {historicas.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
              Emisiones anteriores
            </h2>
            <span className="hv-label-sm" style={{ fontSize: 11 }}>
              {historicas.length} liquidadas
            </span>
          </div>
          <div className="hv-glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Emisión', 'Cultivo', 'Emitido', 'Precio HRV', 'Liquidada a', 'Δ vs referencia'].map((h) => (
                    <th
                      key={h}
                      className="hv-label-sm"
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.02)',
                        fontSize: 9,
                        borderBottom: '1px solid var(--hv-border-subtle)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historicas.map((t) => {
                  const ref = Number(t.precioReferenciaUsdTn);
                  const liq = Number(t.precioLiquidacionUsdTn ?? 0);
                  const deltaPct = ref > 0 ? ((liq - ref) / ref) * 100 : 0;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: 'var(--hv-text)', fontWeight: 500 }}>
                          {t.campania.establecimiento?.nombre ?? t.campania.nombre}
                        </div>
                        <div className="hv-label-sm" style={{ fontSize: 9, marginTop: 2 }}>
                          {t.campania.cicloAgricola} · {t.campania.establecimiento?.partido}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--hv-text-2)', fontSize: 13 }}>
                        {t.campania.cultivo?.nombre}
                      </td>
                      <td className="hv-mono" style={{ padding: '12px 16px', color: 'var(--hv-text-2)', fontSize: 13 }}>
                        {toneladas(t.toneladasOfrecidas, 0)}
                      </td>
                      <td className="hv-mono" style={{ padding: '12px 16px', color: 'var(--hv-text-2)', fontSize: 13 }}>
                        {usd(t.precioTokenUsd, 2)}
                      </td>
                      <td className="hv-mono" style={{ padding: '12px 16px', color: 'var(--hv-text)', fontWeight: 600, fontSize: 13 }}>
                        {usd(liq, 2)}
                      </td>
                      <td
                        className="hv-mono"
                        style={{
                          padding: '12px 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          color: deltaPct >= 0 ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
                        }}
                      >
                        {porcentaje(deltaPct, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function MetricaProductor({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid var(--hv-border-subtle)',
      }}
    >
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div
        className="hv-mono"
        style={{ fontSize: 20, fontWeight: 600, color: accent ? 'var(--hv-green-text)' : 'var(--hv-text)', marginTop: 4 }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Gráfico SVG de la serie histórica 90d + anotaciones de las emisiones
 * de este productor sobre esa serie. Cada anotación muestra el precio HRV
 * al momento de la emisión, así el inversor ve el "gap" en el tiempo.
 */
function GraficoTrazabilidad({
  cultivo,
  serie,
  emisiones,
}: {
  cultivo: Cultivo;
  serie: { fecha: string; usdTn: number }[];
  emisiones: any[];
}) {
  const live = usePrecioLive(cultivo);
  if (serie.length === 0) return null;

  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 100, bottom: 40, left: 60 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const precios = serie.map((s) => s.usdTn);
  const min = Math.min(...precios, live.usdTn) * 0.95;
  const max = Math.max(...precios, live.usdTn) * 1.05;
  const rango = max - min || 1;

  const t0 = new Date(serie[0].fecha).getTime();
  const tN = new Date(serie[serie.length - 1].fecha).getTime();
  const spanT = tN - t0 || 1;

  const puntos = serie.map((s) => {
    const x = padding.left + ((new Date(s.fecha).getTime() - t0) / spanT) * innerW;
    const y = padding.top + (1 - (s.usdTn - min) / rango) * innerH;
    return { x, y, s };
  });

  const linePath = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L ${puntos[puntos.length - 1].x},${padding.top + innerH} L ${puntos[0].x},${padding.top + innerH} Z`;

  return (
    <div className="hv-glass" style={{ borderRadius: 16, padding: 20 }}>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="hv-label" style={{ fontSize: 10 }}>Precio pizarra · {cultivo}</div>
          <div className="hv-mono" style={{ fontSize: 28, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.025em', marginTop: 4 }}>
            {usd(live.usdTn, 2)}
          </div>
        </div>
        <div className="hv-chip hv-chip-green" style={{ fontSize: 11 }}>
          <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
          en vivo
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padding.top + f * innerH;
          const val = max - f * rango;
          return (
            <g key={f}>
              <line x1={padding.left} y1={y} x2={padding.left + innerW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <text
                x={padding.left - 10}
                y={y + 3}
                textAnchor="end"
                fill="var(--hv-text-dim)"
                fontSize="10"
                fontFamily="var(--hv-font-mono)"
              >
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaPath} fill="var(--hv-green)" fillOpacity="0.08" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="var(--hv-green)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

        {/* Emisiones anotadas */}
        {emisiones.map((e) => {
          const emisionT = new Date(e.createdAt).getTime();
          if (emisionT < t0 || emisionT > tN) return null;
          const x = padding.left + ((emisionT - t0) / spanT) * innerW;
          const y = padding.top + (1 - (Number(e.precioTokenUsd) - min) / rango) * innerH;
          return (
            <g key={e.id}>
              <line x1={x} y1={padding.top} x2={x} y2={padding.top + innerH} stroke="var(--hv-amber)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
              <circle cx={x} cy={y} r="5" fill="var(--hv-amber)" />
              <circle cx={x} cy={y} r="9" fill="var(--hv-amber)" fillOpacity="0.2" />
            </g>
          );
        })}

        {/* Precio live actual */}
        {(() => {
          const y = padding.top + (1 - (live.usdTn - min) / rango) * innerH;
          return (
            <g>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerW}
                y2={y}
                stroke="var(--hv-green)"
                strokeDasharray="4,4"
                strokeWidth="1"
                opacity="0.5"
              />
              <rect
                x={padding.left + innerW + 6}
                y={y - 10}
                width="80"
                height="20"
                rx="4"
                fill="var(--hv-green)"
              />
              <text
                x={padding.left + innerW + 46}
                y={y + 4}
                textAnchor="middle"
                fill="var(--hv-bg-token)"
                fontSize="11"
                fontWeight="700"
                fontFamily="var(--hv-font-mono)"
              >
                live {live.usdTn.toFixed(0)}
              </text>
            </g>
          );
        })()}

        {/* Eje X: labels */}
        {[0, 0.33, 0.66, 1].map((f) => {
          const x = padding.left + f * innerW;
          const ts = t0 + f * spanT;
          return (
            <text
              key={f}
              x={x}
              y={height - 15}
              textAnchor="middle"
              fill="var(--hv-text-dim)"
              fontSize="10"
              fontFamily="var(--hv-font-mono)"
            >
              {new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
            </text>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-2 hv-label-sm" style={{ fontSize: 10 }}>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 12, height: 2, background: 'var(--hv-green)', borderRadius: 1 }} />
          Pizarra
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, background: 'var(--hv-amber)', borderRadius: '50%' }} />
          Emisión de este productor
        </span>
      </div>
    </div>
  );
}

function CardCampaniaCompacta({ t }: { t: any }) {
  const pctFondeado = t.tokensEmitidos > 0 ? (t.tokensVendidos / t.tokensEmitidos) * 100 : 0;
  return (
    <Link
      to={`/tk/invertir/${t.id}`}
      style={{
        display: 'block',
        padding: 16,
        background: 'var(--hv-bg-panel)',
        border: '1px solid var(--hv-border)',
        borderRadius: 12,
        boxShadow: 'var(--hv-inset-top)',
        textDecoration: 'none',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 600 }}>
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </div>
          <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 3 }}>
            {t.campania.cultivo?.nombre} · {hectareas(Number(t.campania.hectareasAfectadas ?? 0))}
          </div>
        </div>
        <div className="flex gap-1">
          <BadgeModo modo={t.modo} />
          {t.campania.estadoToken && <EstadoCampanaBadge estado={t.campania.estadoToken} />}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>Precio</div>
          <div className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)' }}>
            {usd(Number(t.precioTokenUsd), 2)}
          </div>
        </div>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>HRV</div>
          <div className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)' }}>
            {toneladas(Number(t.toneladasOfrecidas), 0)}
          </div>
        </div>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>Cierra</div>
          <div className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)' }}>
            {diasRestantes(t.fondeoHasta)}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <BarraFondeo vendidos={Number(t.tokensVendidos)} emitidos={Number(t.tokensEmitidos)} compacta />
        <div className="hv-mono" style={{ fontSize: 10, color: 'var(--hv-text-muted)', marginTop: 4 }}>
          {pctFondeado.toFixed(0)}% fondeado · cosecha {t.campania.fechaCosechaEstimada ? fecha(t.campania.fechaCosechaEstimada) : '—'}
        </div>
      </div>
    </Link>
  );
}
