import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi, type FiltrosMarketplace } from '../services/tokenizadasService';
import { ModalCosecha } from '../components/marketplace/ModalCosecha';
import { BadgeModo } from '../components/campana/BadgeModo';
import { BarraFondeo } from '../components/campana/BarraFondeo';
import { Sparkline } from '../components/charts/Sparkline';
import { useHistoriaPrecios, usePreciosLive } from '../hooks/usePreciosLive';
import { normalizarCultivo, type Cultivo } from '../services/mockPreciosService';
import { usd, usdTn, porcentaje, toneladas, diasRestantes, fechaCorta } from '../utils/format';
import type { ModoTokenizacion, Tokenizacion } from '../types/tokenizadas';

const CULTIVOS = ['soja', 'maiz', 'trigo', 'girasol'];
const PROVINCIAS = ['Buenos Aires', 'Córdoba', 'Santa Fe', 'La Pampa'];

/**
 * Listado principal de cosechas tokenizadas — `/invertir`.
 * Fue rediseñado desde grid de cards a tabla con columnas + modal de detalle
 * inline. Cada fila resume la emisión, cliqueás y se abre el detalle con
 * precio HRV vs pizarra live, gráfico del grano, clima/lluvia y CTA de compra.
 */
export function MarketplacePage() {
  const [filtros, setFiltros] = useState<FiltrosMarketplace>({ orden: 'cierra_pronto' });
  const [seleccionada, setSeleccionada] = useState<Tokenizacion | null>(null);

  const { data: cosechas = [], isLoading } = useQuery({
    queryKey: ['tk', 'marketplace', filtros],
    queryFn: () => tokenizadasApi.marketplace(filtros),
  });

  const setF = <K extends keyof FiltrosMarketplace>(k: K, v: FiltrosMarketplace[K]) =>
    setFiltros((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="hv-label" style={{ fontSize: 10 }}>Cosechas tokenizadas · Solana devnet</div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.028em',
              color: 'var(--hv-text)',
              marginTop: 6,
              lineHeight: 1.05,
            }}
          >
            Cosechas
          </h1>
          <p className="hv-label-sm" style={{ marginTop: 4 }}>
            {cosechas.length} emisiones abiertas · click en cualquier fila para ver el detalle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hv-label-sm" style={{ fontSize: 10 }}>Ordenar</span>
          <select
            value={filtros.orden}
            onChange={(e) => setF('orden', e.target.value as FiltrosMarketplace['orden'])}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
          >
            <option value="cierra_pronto">Cierra pronto</option>
            <option value="mayor_descuento">Mayor descuento</option>
            <option value="menor_riesgo">Menor riesgo</option>
            <option value="recientes">Recién publicadas</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <aside className="space-y-5">
          <FiltroGrupo titulo="Cultivo">
            {CULTIVOS.map((c) => (
              <FiltroChip
                key={c}
                label={c}
                activo={filtros.cultivo === c}
                onClick={() => setF('cultivo', filtros.cultivo === c ? undefined : c)}
              />
            ))}
          </FiltroGrupo>

          <FiltroGrupo titulo="Provincia">
            {PROVINCIAS.map((p) => (
              <FiltroChip
                key={p}
                label={p}
                activo={filtros.provincia === p}
                onClick={() => setF('provincia', filtros.provincia === p ? undefined : p)}
              />
            ))}
          </FiltroGrupo>

          <FiltroGrupo titulo="Modo">
            {(['porcentual', 'fijo'] as ModoTokenizacion[]).map((m) => (
              <FiltroChip
                key={m}
                label={m}
                activo={filtros.modo === m}
                onClick={() => setF('modo', filtros.modo === m ? undefined : m)}
              />
            ))}
          </FiltroGrupo>

          <FiltroGrupo titulo="Descuento mínimo">
            <div className="px-2 pt-1 w-full">
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={filtros.descuentoMin ?? 0}
                onChange={(e) => setF('descuentoMin', Number(e.target.value) || undefined)}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>0%</span>
                <span className="tabular-nums text-white/80 font-medium">{filtros.descuentoMin ?? 0}%</span>
                <span>20%</span>
              </div>
            </div>
          </FiltroGrupo>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={!!filtros.soloConGarantias}
              onChange={(e) => setF('soloConGarantias', e.target.checked || undefined)}
              className="accent-emerald-500"
            />
            <span className="text-white/60 text-xs group-hover:text-white/90">Solo con garantías</span>
          </label>

          <button
            onClick={() => setFiltros({ orden: 'cierra_pronto' })}
            className="w-full text-xs text-white/40 hover:text-white/80 py-2 border-t border-white/5"
          >
            Limpiar filtros
          </button>
        </aside>

        <div>
          {isLoading ? (
            <TablaSkeleton />
          ) : cosechas.length === 0 ? (
            <EstadoVacio onReset={() => setFiltros({ orden: 'cierra_pronto' })} />
          ) : (
            <TablaCosechas cosechas={cosechas} onSeleccionar={setSeleccionada} />
          )}
        </div>
      </div>

      <ModalCosecha cosecha={seleccionada} onClose={() => setSeleccionada(null)} />
    </div>
  );
}

// ─── Tabla ────────────────────────────────────────────────────────

function TablaCosechas({
  cosechas,
  onSeleccionar,
}: {
  cosechas: Tokenizacion[];
  onSeleccionar: (t: Tokenizacion) => void;
}) {
  const ticks = usePreciosLive();

  return (
    <div
      style={{
        background: 'var(--hv-bg-panel)',
        border: '1px solid var(--hv-border)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: 'var(--hv-inset-top)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead
            style={{
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--hv-text-muted)',
              borderBottom: '1px solid var(--hv-border-subtle)',
            }}
          >
            <tr>
              <ThCosecha align="left">Cosecha</ThCosecha>
              <ThCosecha align="left">Modo</ThCosecha>
              <ThCosecha align="right">Precio HRV</ThCosecha>
              <ThCosecha align="right">vs pizarra</ThCosecha>
              <ThCosecha align="left" width={160}>Fondeo</ThCosecha>
              <ThCosecha align="left">Serie 60d</ThCosecha>
              <ThCosecha align="right">Cierra</ThCosecha>
              <ThCosecha align="right">Cosecha</ThCosecha>
              <ThCosecha align="center">Garantías</ThCosecha>
              <th aria-hidden style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
            {cosechas.map((t) => {
              const cultivo = normalizarCultivo(t.campania.cultivo?.nombre);
              const tick = ticks.find((x) => x.cultivo === cultivo);
              const pizarra = tick?.usdTn ?? t.precioReferenciaUsdTn;
              const spreadPct = ((pizarra - t.precioTokenUsd) / t.precioTokenUsd) * 100;
              return (
                <FilaCosecha
                  key={t.id}
                  t={t}
                  cultivo={cultivo}
                  pizarraLive={pizarra}
                  spreadPct={spreadPct}
                  onClick={() => onSeleccionar(t)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThCosecha({
  children,
  align,
  width,
}: {
  children?: React.ReactNode;
  align: 'left' | 'right' | 'center';
  width?: number;
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '12px 14px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        width,
      }}
    >
      {children}
    </th>
  );
}

function FilaCosecha({
  t,
  cultivo,
  pizarraLive,
  spreadPct,
  onClick,
}: {
  t: Tokenizacion;
  cultivo: Cultivo;
  pizarraLive: number;
  spreadPct: number;
  onClick: () => void;
}) {
  const historia = useHistoriaPrecios(cultivo, 40);
  const pctFondeado = t.tokensEmitidos > 0 ? (t.tokensVendidos / t.tokensEmitidos) * 100 : 0;
  const spreadUp = spreadPct >= 0;
  const partido = t.campania.establecimiento?.partido ?? '—';
  const provincia = t.campania.establecimiento?.provincia ?? '—';

  const garantias = useMemo(() => {
    const items: { icon: string; title: string }[] = [];
    if (t.tieneSeguroGranizo) items.push({ icon: '❄', title: 'Seguro granizo' });
    if (t.tieneSeguroParametrico) items.push({ icon: '⚡', title: 'Paramétrico' });
    if (t.tieneAvalSgr) items.push({ icon: '✓', title: 'Aval SGR' });
    return items;
  }, [t.tieneSeguroGranizo, t.tieneSeguroParametrico, t.tieneAvalSgr]);

  return (
    <tr
      onClick={onClick}
      className="hv-fila-cosecha"
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid var(--hv-border-subtle)',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '14px' }}>
        <div style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>
          {t.campania.establecimiento?.nombre ?? t.campania.nombre}
        </div>
        <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 3 }}>
          {t.campania.cultivo?.nombre} · {partido}, {provincia}
        </div>
      </td>

      <td style={{ padding: '14px' }}>
        <BadgeModo modo={t.modo} />
      </td>

      <td style={{ padding: '14px', textAlign: 'right' }}>
        <div className="hv-mono" style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
          {usd(t.precioTokenUsd, 2)}
        </div>
        <div className="hv-mono" style={{ fontSize: 10, color: 'var(--hv-text-muted)', marginTop: 2 }}>
          por HRV
        </div>
      </td>

      <td style={{ padding: '14px', textAlign: 'right' }}>
        <div
          className="hv-mono"
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: spreadUp ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
          }}
        >
          {porcentaje(spreadPct, 1)}
        </div>
        <div className="hv-mono" style={{ fontSize: 10, color: 'var(--hv-text-muted)', marginTop: 2 }}>
          pizarra {usdTn(pizarraLive)}
        </div>
      </td>

      <td style={{ padding: '14px' }}>
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="hv-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--hv-text)' }}>
            {pctFondeado.toFixed(0)}%
          </span>
          <span className="hv-mono" style={{ fontSize: 9, color: 'var(--hv-text-muted)' }}>
            {toneladas(t.tokensVendidos, 0)}/{toneladas(t.tokensEmitidos, 0)}
          </span>
        </div>
        <BarraFondeo vendidos={t.tokensVendidos} emitidos={t.tokensEmitidos} compacta />
      </td>

      <td style={{ padding: '14px' }}>
        <Sparkline data={historia.map((h) => h.usdTn)} width={100} height={30} strokeWidth={1.6} />
      </td>

      <td style={{ padding: '14px', textAlign: 'right' }}>
        <div className="hv-mono" style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 12 }}>
          {diasRestantes(t.fondeoHasta)}
        </div>
        <div className="hv-mono" style={{ fontSize: 10, color: 'var(--hv-text-muted)', marginTop: 2 }}>
          {fechaCorta(t.fondeoHasta)}
        </div>
      </td>

      <td style={{ padding: '14px', textAlign: 'right' }}>
        <div className="hv-mono" style={{ color: 'var(--hv-text-2)', fontSize: 12 }}>
          {t.campania.fechaCosechaEstimada ? fechaCorta(t.campania.fechaCosechaEstimada) : '—'}
        </div>
      </td>

      <td style={{ padding: '14px' }}>
        {garantias.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--hv-text-muted)', fontSize: 12 }}>—</div>
        ) : (
          <div className="flex items-center justify-center gap-1">
            {garantias.map((g) => (
              <span
                key={g.title}
                title={g.title}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--hv-green-soft)',
                  color: 'var(--hv-green-text)',
                  fontSize: 10,
                  border: '1px solid rgba(43,224,106,0.20)',
                }}
              >
                {g.icon}
              </span>
            ))}
          </div>
        )}
      </td>

      <td style={{ padding: '14px 12px', color: 'var(--hv-text-muted)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </td>
    </tr>
  );
}

// ─── Filtros ──────────────────────────────────────────────────────

function FiltroGrupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">{titulo}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FiltroChip({ label, activo, onClick }: { label: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${
        activo
          ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Skeleton + vacío ─────────────────────────────────────────────

function TablaSkeleton() {
  return (
    <div
      style={{
        background: 'var(--hv-bg-panel)',
        border: '1px solid var(--hv-border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-center gap-4 px-4 py-4"
          style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}
        >
          <div className="h-3 w-40 rounded bg-white/5" />
          <div className="h-3 w-16 rounded bg-white/5" />
          <div className="h-3 w-20 rounded bg-white/5" />
          <div className="h-3 w-24 rounded bg-white/5 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function EstadoVacio({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="hv-glass"
      style={{
        padding: 48,
        borderRadius: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          margin: '0 auto 14px',
          borderRadius: 12,
          background: 'var(--hv-green-soft)',
          border: '1px solid rgba(43,224,106,0.24)',
          color: 'var(--hv-green-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        ◉
      </div>
      <div style={{ color: 'var(--hv-text)', fontSize: 16, fontWeight: 600 }}>
        Sin cosechas con estos filtros
      </div>
      <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6 }}>
        Probá aflojando algún filtro para ver más resultados.
      </p>
      <button
        onClick={onReset}
        className="hv-cta-ghost"
        style={{ marginTop: 18, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}
      >
        Limpiar filtros
      </button>
    </div>
  );
}
