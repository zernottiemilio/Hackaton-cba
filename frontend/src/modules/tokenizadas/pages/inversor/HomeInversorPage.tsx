import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { productoresApi, type ProductorResumen } from '../../services/productoresService';
import { useWalletStore, useNombreWallet } from '../../stores/walletStore';
import { usePreciosLive, useHistoriaPrecios } from '../../hooks/usePreciosLive';
import { TickerGrande } from '../../components/precios/TickerGrande';
import { ChipEnVivo } from '../../components/precios/ChipEnVivo';
import { Sparkline } from '../../components/charts/Sparkline';
import { BarraFondeo } from '../../components/campana/BarraFondeo';
import { BadgeModo } from '../../components/campana/BadgeModo';
import { usd, usdCompacto, toneladas, diasRestantes } from '../../utils/format';
import type { Tokenizacion } from '../../types/tokenizadas';
import { normalizarCultivo, type Cultivo } from '../../services/mockPreciosService';

/**
 * Elige el font-size del balance USDC en función de cuántos caracteres
 * ocupa el número formateado. La card tiene 480px de ancho fijo con 48px
 * de padding horizontal (432px útiles). "US$ 1.430.175,20" son 16 chars.
 *
 * A ~0.55em por char en la fuente hv-mono, entra:
 *   - 10 chars ("US$ 999,00") → 42px cómodos.
 *   - 14 chars ("US$ 99.999,00") → 36px.
 *   - 17 chars ("US$ 999.999,00") → 30px.
 *   - 19 chars ("US$ 9.999.999,00") → 26px.
 * Nunca cortamos: el balance es el dato central de la card.
 */
function fitBalanceFontSize(monto: number): number {
  const chars = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto).length;
  if (chars <= 10) return 42;
  if (chars <= 12) return 40;
  if (chars <= 14) return 36;
  if (chars <= 16) return 32;
  if (chars <= 18) return 28;
  return 24;
}

/**
 * Home del inversor — la vista que se muestra cuando el contexto activo es
 * `inversor`. Prioriza:
 *  1. Balance USDC disponible visible arriba (con qué comprar)
 *  2. Oportunidades del día ordenadas por spread contra pizarra live
 *  3. Grid de productores con rating para descubrimiento por reputación
 */
export function HomeInversorPage() {
  const conectada = useWalletStore((s) => s.conectada);
  const nombreCompleto = useNombreWallet();
  const ticks = usePreciosLive();

  const { data: emisiones = [] } = useQuery({
    queryKey: ['tk', 'marketplace', 'inversor'],
    queryFn: () => tokenizadasApi.marketplace({ orden: 'cierra_pronto' }),
  });

  const { data: productores = [] } = useQuery({
    queryKey: ['tk', 'productores'],
    queryFn: () => productoresApi.listar(),
  });

  // Oportunidades: cada emisión abierta enriquecida con el precio pizarra LIVE
  // y el spread real actualizado en cada tick.
  const oportunidades = emisiones
    .map((e) => {
      const cultivoNombre = normalizarCultivo(e.campania.cultivo?.nombre);
      const tick = ticks.find((t) => t.cultivo === cultivoNombre);
      const pizarraLive = tick?.usdTn ?? e.precioReferenciaUsdTn;
      const spreadPct = ((e.precioTokenUsd - pizarraLive) / pizarraLive) * 100;
      return { e, cultivoNombre, pizarraLive, spreadPct };
    })
    .sort((a, b) => a.spreadPct - b.spreadPct); // más negativo = mejor oportunidad

  const nombre = nombreCompleto.split(' ')[0] || 'inversor';

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header inversor: saludo + balance grande */}
      <section
        className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-6 items-stretch"
      >
        <div>
          <div className="hv-label" style={{ fontSize: 10 }}>Vista inversor · Solana devnet</div>
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              color: 'var(--hv-text)',
              marginTop: 8,
            }}
          >
            Hola {nombre}
          </motion.h1>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 15, marginTop: 8, maxWidth: 560 }}>
            {emisiones.length} emisiones abiertas para invertir hoy. Ordenadas por descuento sobre pizarra live.
          </p>
        </div>

        {/* Balance USDC — la card más visible */}
        <div
          style={{
            borderRadius: 20,
            padding: 24,
            background: 'linear-gradient(180deg, rgba(43,224,106,0.14) 0%, rgba(43,224,106,0.04) 100%)',
            border: '1px solid rgba(43,224,106,0.35)',
            boxShadow: '0 0 40px rgba(43,224,106,0.08), var(--hv-inset-top)',
          }}
        >
          <div className="flex items-baseline justify-between mb-1">
            <div className="hv-label" style={{ fontSize: 10, color: 'var(--hv-green-text)' }}>
              Balance disponible
            </div>
            <span className="hv-label-sm hv-mono" style={{ fontSize: 10 }}>
              USDC
            </span>
          </div>
          {conectada ? (
            <>
              {/* Font-size dinámico según el largo del número. Nunca cortamos:
                  el balance completo (US$ 1.430.175,20) tiene que ser legible
                  siempre — es el dato más importante de la card. */}
              <div
                className="hv-mono"
                style={{
                  fontSize: fitBalanceFontSize(conectada.balanceUsdc),
                  fontWeight: 600,
                  color: 'var(--hv-text)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {usd(conectada.balanceUsdc, 2)}
              </div>
              <div className="hv-mono" style={{ fontSize: 11, color: 'var(--hv-text-muted)', marginTop: 8 }}>
                + {conectada.balanceSol.toFixed(4)} SOL para gas
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(43,224,106,0.15)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--hv-text-2)' }}>Poder de compra</span>
                  <span className="hv-mono" style={{ color: 'var(--hv-green-text)', fontWeight: 600 }}>
                    ~{Math.floor(conectada.balanceUsdc / (ticks[0]?.usdTn ?? 300))} HRV
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--hv-text-muted)', fontSize: 13, padding: '12px 0' }}>
              Conectá tu wallet para ver balance
            </div>
          )}
        </div>
      </section>

      {/* Pizarra de precios en vivo */}
      {ticks.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
                Pizarra de precios en vivo
              </h2>
              <p className="hv-label-sm" style={{ marginTop: 4 }}>
                Precios reales · granos.ar (Consiagro / BCR)
              </p>
            </div>
            <ChipEnVivo />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {ticks.map((t) => (
              <TickerGrande key={t.cultivo} cultivo={t.cultivo} usdTn={t.usdTn} cambio={t.cambio24hPct} />
            ))}
          </div>
        </section>
      )}

      {/* Oportunidades del día */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
              Oportunidades del día
            </h2>
            <p className="hv-label-sm" style={{ marginTop: 4 }}>
              Emisiones abiertas · descuento sobre pizarra actualizado en vivo
            </p>
          </div>
          <span className="hv-chip hv-chip-green" style={{ fontSize: 11 }}>
            <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
            live · oráculo
          </span>
        </div>

        {oportunidades.length === 0 ? (
          <div className="hv-glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--hv-text-muted)' }}>
            No hay emisiones abiertas ahora mismo.
          </div>
        ) : (
          <div className="space-y-3">
            {oportunidades.slice(0, 5).map(({ e, cultivoNombre, pizarraLive, spreadPct }) => (
              <CardOportunidad
                key={e.id}
                t={e}
                cultivo={cultivoNombre}
                pizarraLive={pizarraLive}
                spreadPct={spreadPct}
              />
            ))}
          </div>
        )}
      </section>

      {/* Productores destacados */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
              Productores en la red
            </h2>
            <p className="hv-label-sm" style={{ marginTop: 4 }}>
              Reputación construida sobre campañas liquidadas y garantías
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {productores.map((p) => (
            <ProductorCard key={p.id} p={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Card grande de oportunidad con precio HRV, pizarra live y gap visible.
 * El gap es el producto: "estás comprando X% más barato de lo que vale ahora".
 */
function CardOportunidad({
  t,
  cultivo,
  pizarraLive,
  spreadPct,
}: {
  t: Tokenizacion;
  cultivo: Cultivo;
  pizarraLive: number;
  spreadPct: number;
}) {
  const historia = useHistoriaPrecios(cultivo, 40);
  const pctFondeado = t.tokensEmitidos > 0 ? (t.tokensVendidos / t.tokensEmitidos) * 100 : 0;
  const ahorroPct = -spreadPct; // spread negativo = ahorro

  return (
    <motion.div whileHover={{ scale: 1.005 }} transition={{ duration: 0.15 }}>
      <Link
        to={`/invertir/${t.id}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 20,
          padding: 20,
          background: 'var(--hv-bg-panel)',
          border: '1px solid var(--hv-border)',
          borderRadius: 16,
          boxShadow: 'var(--hv-inset-top)',
          textDecoration: 'none',
          transition: 'all 150ms ease',
        }}
        className="hover:border-white/15"
      >
        <div className="flex flex-col gap-3">
          {/* Título */}
          <div className="flex items-start gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: 'var(--hv-text)', fontSize: 16, fontWeight: 600 }}>
                  {t.campania.establecimiento?.nombre ?? t.campania.nombre}
                </span>
                <BadgeModo modo={t.modo} />
              </div>
              <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 4 }}>
                {t.campania.cultivo?.nombre} · {t.campania.establecimiento?.partido} ·{' '}
                {toneladas(t.toneladasOfrecidas, 0)} · cierra en {diasRestantes(t.fondeoHasta)}
              </div>
            </div>
          </div>

          {/* Precios comparativos con gap visual */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 16,
              alignItems: 'center',
              padding: '14px 16px',
              background: 'var(--hv-bg-input)',
              border: '1px solid var(--hv-border-subtle)',
              borderRadius: 12,
            }}
          >
            <div>
              <div className="hv-label-sm" style={{ fontSize: 9 }}>Precio HRV</div>
              <div
                className="hv-mono"
                style={{ fontSize: 20, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em', marginTop: 2 }}
              >
                {usd(t.precioTokenUsd, 2)}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 12px',
                borderRadius: 999,
                background: ahorroPct > 0 ? 'var(--hv-green-soft)' : 'var(--hv-red-soft)',
                border: `1px solid ${ahorroPct > 0 ? 'rgba(43,224,106,0.3)' : 'var(--hv-red-strong)'}`,
              }}
            >
              <span
                className="hv-mono"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: ahorroPct > 0 ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
                }}
              >
                {ahorroPct > 0 ? `−${ahorroPct.toFixed(1)}%` : `+${(-ahorroPct).toFixed(1)}%`}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hv-label-sm" style={{ fontSize: 9 }}>Pizarra live</div>
              <div
                className="hv-mono"
                style={{ fontSize: 20, fontWeight: 600, color: 'var(--hv-text-2)', letterSpacing: '-0.02em', marginTop: 2 }}
              >
                {usd(pizarraLive, 2)}
              </div>
            </div>
          </div>

          {/* Fondeo */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="hv-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--hv-text)' }}>
                  {pctFondeado.toFixed(0)}% fondeado
                </span>
              </div>
              <span className="hv-mono" style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
                {toneladas(t.tokensVendidos, 0)} / {toneladas(t.tokensEmitidos, 0)}
              </span>
            </div>
            <BarraFondeo vendidos={t.tokensVendidos} emitidos={t.tokensEmitidos} compacta />
          </div>
        </div>

        {/* Sparkline lateral */}
        <div className="flex flex-col items-center justify-center gap-2 pl-4" style={{ borderLeft: '1px solid var(--hv-border-subtle)' }}>
          <Sparkline data={historia.map((h) => h.usdTn)} width={110} height={44} strokeWidth={2} />
          <div className="hv-label-sm" style={{ fontSize: 9 }}>30d</div>
        </div>
      </Link>
    </motion.div>
  );
}

/** Card de productor con rating y campañas activas. */
function ProductorCard({ p }: { p: ProductorResumen }) {
  return (
    <Link
      to={`/productor/${p.id}`}
      style={{
        display: 'block',
        padding: 18,
        background: 'var(--hv-bg-panel)',
        border: '1px solid var(--hv-border)',
        borderRadius: 14,
        boxShadow: 'var(--hv-inset-top)',
        textDecoration: 'none',
        transition: 'all 150ms ease',
      }}
      className="hover:border-white/15"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--hv-green-deep), var(--hv-green-mid))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--hv-bg-token)',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {p.nombre[0]}
          </div>
          <div>
            <div style={{ color: 'var(--hv-text)', fontSize: 14, fontWeight: 600 }}>{p.nombre}</div>
            <div className="hv-label-sm" style={{ fontSize: 10, marginTop: 2 }}>
              {p.provincia ?? 'AR'}
            </div>
          </div>
        </div>
        <Rating value={p.rating} />
      </div>
      <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
        <MiniStat label="Activas" value={String(p.metricas?.campaniasActivas ?? 0)} />
        <MiniStat label="Liquidadas" value={String(p.metricas?.campaniasLiquidadas ?? 0)} />
        <MiniStat label="Vol." value={usdCompacto(p.metricas?.usdRecaudadoTotal ?? 0)} />
      </div>
      {p.cultivos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {p.cultivos.slice(0, 4).map((c) => (
            <span
              key={c}
              className="hv-mono"
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--hv-border-subtle)',
                color: 'var(--hv-text-muted)',
                textTransform: 'lowercase',
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div
        className="hv-mono"
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)', marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Rating con estrellas, tipo App Store.
 * Defensivo: si el backend no manda el score (productor recién seedeado
 * sin campañas, o payload incompleto), rompía toda la pantalla con
 * `undefined.toFixed`. Ahora clampea + fallback a 0 y renderiza igual.
 */
export function Rating({ value, size = 12 }: { value: number | null | undefined; size?: number }) {
  const v = typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(5, value))
    : 0;
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  const empty = Math.max(0, 5 - full - (half ? 1 : 0));
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex" style={{ gap: 1 }}>
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f${i}`} state="full" size={size} />
        ))}
        {half && <Star state="half" size={size} />}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e${i}`} state="empty" size={size} />
        ))}
      </div>
      <span
        className="hv-mono"
        style={{ fontSize: size, fontWeight: 600, color: 'var(--hv-text)', marginLeft: 2 }}
      >
        {v.toFixed(1)}
      </span>
    </div>
  );
}

function Star({ state, size }: { state: 'full' | 'half' | 'empty'; size: number }) {
  const fill = state === 'full' ? 'var(--hv-green)' : state === 'half' ? 'var(--hv-green)' : 'transparent';
  const stroke = 'var(--hv-green)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round">
      {state === 'half' ? (
        <defs>
          <linearGradient id={`half-${Math.random()}`}>
            <stop offset="50%" stopColor="var(--hv-green)" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      ) : null}
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
