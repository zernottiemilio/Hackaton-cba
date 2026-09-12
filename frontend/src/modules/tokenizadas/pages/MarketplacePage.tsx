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
import type { ModoTokenizacion, ProductorPublico, Tokenizacion } from '../types/tokenizadas';

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

  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const { data: cosechas = [], isLoading } = useQuery({
    queryKey: ['tk', 'marketplace', filtros],
    queryFn: () => tokenizadasApi.marketplace(filtros),
  });
  // Reputación de productores: una sola query pública, se cruza por id en cada fila.
  const { data: productores = [] } = useQuery({
    queryKey: ['tk', 'productores'],
    queryFn: () => tokenizadasApi.listarProductores(),
    staleTime: 60_000,
  });
  const productoresPorId = useMemo(
    () => Object.fromEntries(productores.map((p) => [p.id, p])) as Record<string, ProductorPublico>,
    [productores],
  );

  const setF = <K extends keyof FiltrosMarketplace>(k: K, v: FiltrosMarketplace[K]) =>
    setFiltros((f) => ({ ...f, [k]: v }));
  const limpiar = () => setFiltros({ orden: 'cierra_pronto' });
  const filtrosActivos = [filtros.cultivo, filtros.provincia, filtros.modo, filtros.descuentoMin, filtros.soloConGarantias]
    .filter((v) => v !== undefined && v !== false).length;

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
          <button
            type="button"
            onClick={() => setFiltrosAbiertos((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filtrosAbiertos || filtrosActivos > 0
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'bg-white/5 text-white/70 hover:bg-white/10 ring-1 ring-white/10'
            }`}
          >
            Filtros{filtrosActivos > 0 ? ` · ${filtrosActivos}` : ''} {filtrosAbiertos ? '▴' : '▾'}
          </button>
          <span className="hv-label-sm" style={{ fontSize: 10, marginLeft: 8 }}>Ordenar</span>
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

      {/* Filtros colapsados arriba (estilo P2P): la tabla ocupa todo el ancho. */}
      {filtrosAbiertos && (
        <div
          className="flex flex-wrap items-start gap-x-8 gap-y-4 mb-5"
          style={{
            background: 'var(--hv-bg-panel)',
            border: '1px solid var(--hv-border)',
            borderRadius: 14,
            padding: '14px 18px',
          }}
        >
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
            {[5, 10, 15].map((d) => (
              <FiltroChip
                key={d}
                label={`≥ ${d}%`}
                activo={filtros.descuentoMin === d}
                onClick={() => setF('descuentoMin', filtros.descuentoMin === d ? undefined : d)}
              />
            ))}
          </FiltroGrupo>
          <FiltroGrupo titulo="Garantías">
            <FiltroChip
              label="Solo con garantías"
              activo={!!filtros.soloConGarantias}
              onClick={() => setF('soloConGarantias', filtros.soloConGarantias ? undefined : true)}
            />
          </FiltroGrupo>
          {filtrosActivos > 0 && (
            <button onClick={limpiar} className="text-xs text-white/40 hover:text-white/80 self-end pb-1">
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <TablaSkeleton />
      ) : cosechas.length === 0 ? (
        <EstadoVacio onReset={limpiar} />
      ) : (
        <TablaCosechas cosechas={cosechas} productores={productoresPorId} onSeleccionar={setSeleccionada} />
      )}

      <ModalCosecha cosecha={seleccionada} onClose={() => setSeleccionada(null)} />
    </div>
  );
}

// ─── Tabla ────────────────────────────────────────────────────────

function TablaCosechas({
  cosechas,
  productores,
  onSeleccionar,
}: {
  cosechas: Tokenizacion[];
  productores: Record<string, ProductorPublico>;
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
              <ThCosecha align="left">Productor</ThCosecha>
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
                  productor={productores[t.productorId]}
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
  productor,
  cultivo,
  pizarraLive,
  spreadPct,
  onClick,
}: {
  t: Tokenizacion;
  productor?: ProductorPublico;
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
        <ReputacionProductor nombre={t.productor?.nombre ?? '—'} productor={productor} />
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

// ─── Reputación del productor (estilo P2P: quién está del otro lado) ──

function ReputacionProductor({ nombre, productor }: { nombre: string; productor?: ProductorPublico }) {
  const liquidadas = productor?.metricas.campaniasLiquidadas ?? 0;
  const positivas = productor?.metricas.liquidadasPositivas ?? 0;
  const cumplimiento = liquidadas > 0 ? Math.round((positivas / liquidadas) * 100) : null;
  const rating = productor?.rating ?? null;
  const verificado = rating !== null && rating >= 4.5;
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 150 }}>
      <div
        className="hv-mono"
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--hv-green-text)',
          background: 'var(--hv-green-soft)',
          border: '1px solid rgba(43,224,106,0.20)',
        }}
      >
        {inicial}
      </div>
      <div style={{ lineHeight: 1.2 }}>
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--hv-text)', fontWeight: 600, fontSize: 12 }}>{nombre}</span>
          {verificado && (
            <span
              title="Productor verificado: rating ≥ 4.5"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#0F1216',
                background: 'var(--hv-green)',
              }}
            >
              ✓
            </span>
          )}
        </div>
        <div className="hv-mono" style={{ fontSize: 10, color: 'var(--hv-text-muted)', marginTop: 3 }}>
          {rating !== null ? (
            <>
              <span style={{ color: 'var(--hv-amber-text)' }}>★</span> {rating.toFixed(1)}
              {' · '}
              {liquidadas} {liquidadas === 1 ? 'liquidada' : 'liquidadas'}
              {cumplimiento !== null && <> · {cumplimiento}% ok</>}
            </>
          ) : (
            'Sin historial'
          )}
        </div>
      </div>
    </div>
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
