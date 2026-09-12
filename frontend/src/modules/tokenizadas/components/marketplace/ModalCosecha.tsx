import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, CloudRain, Droplets, Thermometer, ShieldCheck } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Tokenizacion } from '../../types/tokenizadas';
import { BadgeModo } from '../campana/BadgeModo';
import { LinksOnChain } from '../campana/LinksOnChain';
import { BarraFondeo } from '../campana/BarraFondeo';
import { useHistoriaPrecios, usePrecioLive } from '../../hooks/usePreciosLive';
import { normalizarCultivo } from '../../services/mockPreciosService';
import { generarClima } from '../../services/mockDatosTecnicosService';
import { usd, usdTn, porcentaje, toneladas, hectareas, fecha, diasRestantes } from '../../utils/format';

interface Props {
  cosecha: Tokenizacion | null;
  onClose: () => void;
}

/**
 * Modal de detalle de una cosecha tokenizada. Se abre al clickear una fila
 * del listado. Muestra en un solo scroll: precio HRV vs pizarra live,
 * variación histórica del grano, clima + lluvias del ciclo, garantías y CTA
 * de compra que lleva a la ficha completa.
 */
export function ModalCosecha({ cosecha, onClose }: Props) {
  useEffect(() => {
    if (!cosecha) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [cosecha, onClose]);

  return (
    <AnimatePresence>
      {cosecha && <ModalContent key={cosecha.id} cosecha={cosecha} onClose={onClose} />}
    </AnimatePresence>
  );
}

function ModalContent({ cosecha: t, onClose }: { cosecha: Tokenizacion; onClose: () => void }) {
  const cultivo = normalizarCultivo(t.campania.cultivo?.nombre);
  const historia = useHistoriaPrecios(cultivo, 60);
  const live = usePrecioLive(cultivo);
  const clima = useMemo(() => generarClima(t.id), [t.id]);

  const superficie = Number(t.campania.hectareasAfectadas ?? 0);
  const partido = t.campania.establecimiento?.partido ?? '—';
  const provincia = t.campania.establecimiento?.provincia ?? '—';
  const pctFondeado = t.tokensEmitidos > 0 ? (t.tokensVendidos / t.tokensEmitidos) * 100 : 0;
  const disponibles = t.disponibilidad?.tokensDisponibles ?? t.tokensEmitidos - t.tokensVendidos;
  const spread = ((live.usdTn - t.precioTokenUsd) / t.precioTokenUsd) * 100;
  const spreadUp = spread >= 0;

  const dataChart = historia.map((h, i) => ({
    idx: i,
    ts: h.ts,
    usdTn: Number(h.usdTn.toFixed(2)),
  }));

  const semaforoColor: Record<typeof clima.semaforo, { color: string; texto: string }> = {
    verde: { color: 'var(--hv-green-text)', texto: 'Ciclo normal' },
    amarillo: { color: 'var(--hv-amber-text)', texto: 'Déficit moderado' },
    rojo: { color: 'var(--hv-red-text)', texto: 'Estrés hídrico' },
  };
  const semaforo = semaforoColor[clima.semaforo];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="relative w-full max-w-4xl"
        style={{
          background: 'var(--hv-bg-panel)',
          border: '1px solid var(--hv-border)',
          borderRadius: 20,
          boxShadow: '0 30px 100px rgba(0,0,0,0.6), var(--hv-inset-top)',
          overflow: 'hidden',
        }}
      >
        <div
          className="relative"
          style={{
            padding: '24px 28px 20px',
            background: 'linear-gradient(135deg, rgba(10,107,18,0.55) 0%, rgba(43,224,106,0.10) 100%)',
            borderBottom: '1px solid var(--hv-border-subtle)',
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex items-center justify-center transition-colors"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid var(--hv-border)',
              color: 'var(--hv-text-2)',
            }}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-2 mb-2 flex-wrap">
            <BadgeModo modo={t.modo} />
            <span className="hv-chip hv-chip-green" style={{ fontSize: 10 }}>
              <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
              cierra en {diasRestantes(t.fondeoHasta)}
            </span>
          </div>
          <h2
            className="relative"
            style={{
              color: 'var(--hv-text)',
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </h2>
          <p className="relative" style={{ color: 'var(--hv-text-2)', fontSize: 13, marginTop: 6 }}>
            {t.campania.cultivo?.nombre} · {hectareas(superficie)} · {partido}, {provincia}
          </p>
          <LinksOnChain
            className="relative"
            mintAddress={t.mintAddress}
            vaultAddress={t.vaultAddress}
            txSignaturePublicacion={t.txSignaturePublicacion}
          />
        </div>

        <div className="p-6 space-y-6" style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          <section
            style={{
              background: 'var(--hv-bg-input)',
              border: '1px solid var(--hv-border-subtle)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="hv-label" style={{ fontSize: 10 }}>Cotización on-chain</div>
                <h3 style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  Precio HRV vs pizarra live
                </h3>
              </div>
              <span
                className="hv-chip"
                style={{
                  fontSize: 10,
                  color: 'var(--hv-green-text)',
                  borderColor: 'rgba(43,224,106,0.28)',
                  background: 'var(--hv-green-soft)',
                }}
              >
                <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
                live · Rosario
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <div className="hv-label-sm" style={{ fontSize: 9 }}>Precio HRV</div>
                <div className="hv-mono" style={{ fontSize: 26, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>
                  {usd(t.precioTokenUsd, 2)}
                </div>
                <div className="hv-mono" style={{ fontSize: 11, color: 'var(--hv-green-text)', marginTop: 4 }}>
                  {porcentaje(-t.descuentoPct, 1)} vs pizarra
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: spreadUp ? 'var(--hv-green-soft)' : 'var(--hv-red-soft)',
                    border: `1px solid ${spreadUp ? 'rgba(43,224,106,0.35)' : 'var(--hv-red-strong)'}`,
                  }}
                >
                  {spreadUp ? (
                    <TrendingUp className="h-4 w-4" style={{ color: 'var(--hv-green-text)' }} />
                  ) : (
                    <TrendingDown className="h-4 w-4" style={{ color: 'var(--hv-red-text)' }} />
                  )}
                  <span
                    className="hv-mono"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: spreadUp ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
                    }}
                  >
                    {porcentaje(spread, 2)}
                  </span>
                </div>
                <div className="hv-label-sm" style={{ fontSize: 9, marginTop: 6 }}>gap actual</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="hv-label-sm" style={{ fontSize: 9 }}>Pizarra live</div>
                <div className="hv-mono" style={{ fontSize: 26, fontWeight: 600, color: 'var(--hv-text-2)', letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>
                  {usdTn(live.usdTn)}
                </div>
                <div
                  className="hv-mono"
                  style={{
                    fontSize: 11,
                    color: live.cambio24hPct >= 0 ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
                    marginTop: 4,
                  }}
                >
                  {porcentaje(live.cambio24hPct, 2)} 24h
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              background: 'var(--hv-bg-input)',
              border: '1px solid var(--hv-border-subtle)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="hv-label" style={{ fontSize: 10 }}>Serie histórica</div>
                <h3 style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  Variación del <span style={{ textTransform: 'capitalize' }}>{cultivo}</span> · últimos 60 ticks
                </h3>
              </div>
            </div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={dataChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${t.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--hv-green)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--hv-green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="idx" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                    contentStyle={{
                      background: 'var(--hv-bg-panel)',
                      border: '1px solid var(--hv-border)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--hv-text)',
                    }}
                    labelStyle={{ color: 'var(--hv-text-muted)', fontSize: 10 }}
                    formatter={((v: number) => [usdTn(v), 'USD/T']) as never}
                  />
                  <Area
                    type="monotone"
                    dataKey="usdTn"
                    stroke="var(--hv-green)"
                    strokeWidth={2}
                    fill={`url(#grad-${t.id})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section
            style={{
              background: 'var(--hv-bg-input)',
              border: '1px solid var(--hv-border-subtle)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="hv-label flex items-center gap-2" style={{ fontSize: 10 }}>
                  <CloudRain className="h-3 w-3" style={{ color: 'var(--hv-green-text)' }} />
                  Clima del ciclo
                </div>
                <h3 style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  Precipitación mensual vs promedio histórico
                </h3>
              </div>
              <span
                className="hv-chip"
                style={{
                  fontSize: 10,
                  color: semaforo.color,
                  borderColor: semaforo.color + '55',
                  background: semaforo.color + '15',
                }}
              >
                <span className="hv-dot" style={{ background: semaforo.color }} />
                {semaforo.texto}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <KpiChip
                icon={<Droplets className="h-3.5 w-3.5" />}
                label="Acumulado ciclo"
                valor={`${clima.acumuladoCicloMm} mm`}
                sub={`Prom: ${clima.promedioHistoricoCicloMm} mm`}
              />
              <KpiChip
                icon={<Droplets className="h-3.5 w-3.5" />}
                label="Déficit"
                valor={`${clima.deficitMm > 0 ? '−' : '+'}${Math.abs(clima.deficitMm)} mm`}
                tono={clima.semaforo}
              />
              <KpiChip
                icon={<Thermometer className="h-3.5 w-3.5" />}
                label="Temp media"
                valor={`${clima.temperaturaMediaC.toFixed(1)}°C`}
                sub={`Última lluvia ${clima.ultimaLluviaDiasAtras}d atrás`}
              />
            </div>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={clima.serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{
                      background: 'var(--hv-bg-panel)',
                      border: '1px solid var(--hv-border)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--hv-text)',
                    }}
                    labelStyle={{ color: 'var(--hv-text-muted)', fontSize: 10 }}
                    formatter={((v: number, name: string) => [`${v} mm`, name === 'mm' ? 'Ciclo actual' : 'Promedio']) as never}
                  />
                  <Bar dataKey="promedioHistorico" fill="rgba(255,255,255,0.08)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="mm" fill="var(--hv-green)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px]" style={{ color: 'var(--hv-text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--hv-green)' }} />
                Ciclo actual
              </span>
              <span className="flex items-center gap-1.5">
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
                Promedio histórico
              </span>
              <span style={{ marginLeft: 'auto' }} className="hv-mono">
                {clima.fuente}
              </span>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              style={{
                background: 'var(--hv-bg-input)',
                border: '1px solid var(--hv-border-subtle)',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div className="hv-label" style={{ fontSize: 10, marginBottom: 10 }}>Fondeo</div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="hv-mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-text)' }}>
                  {pctFondeado.toFixed(0)}%
                </div>
                <div className="hv-mono" style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
                  {toneladas(t.tokensVendidos, 0)} / {toneladas(t.tokensEmitidos, 0)}
                </div>
              </div>
              <BarraFondeo vendidos={t.tokensVendidos} emitidos={t.tokensEmitidos} compacta />
              <div className="flex items-center justify-between mt-4 text-xs">
                <span style={{ color: 'var(--hv-text-2)' }}>Disponibles</span>
                <span className="hv-mono" style={{ color: 'var(--hv-text)', fontWeight: 600 }}>
                  {toneladas(disponibles, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span style={{ color: 'var(--hv-text-2)' }}>Recaudado</span>
                <span className="hv-mono" style={{ color: 'var(--hv-green-text)', fontWeight: 600 }}>
                  {usd(t.montoRecaudadoUsd, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span style={{ color: 'var(--hv-text-2)' }}>Objetivo</span>
                <span className="hv-mono" style={{ color: 'var(--hv-text-muted)' }}>
                  {usd(t.montoObjetivoUsd, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span style={{ color: 'var(--hv-text-2)' }}>Cosecha estimada</span>
                <span className="hv-mono" style={{ color: 'var(--hv-text)', fontWeight: 600 }}>
                  {t.campania.fechaCosechaEstimada ? fecha(t.campania.fechaCosechaEstimada) : '—'}
                </span>
              </div>
            </div>
            <div
              style={{
                background: 'var(--hv-bg-input)',
                border: '1px solid var(--hv-border-subtle)',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div className="hv-label flex items-center gap-2" style={{ fontSize: 10, marginBottom: 10 }}>
                <ShieldCheck className="h-3 w-3" style={{ color: 'var(--hv-green-text)' }} />
                Garantías
              </div>
              <div className="space-y-2">
                <ItemGarantia activo={t.tieneSeguroGranizo} label="Seguro contra granizo" />
                <ItemGarantia activo={t.tieneSeguroParametrico} label="Seguro paramétrico (déficit hídrico)" />
                <ItemGarantia activo={t.tieneAvalSgr} label="Aval de SGR" />
                {t.sobrecolateralPct > 0 && (
                  <ItemGarantia activo label={`Sobrecolateralización ${t.sobrecolateralPct}%`} />
                )}
              </div>
            </div>
          </section>
        </div>

        <div
          className="flex items-center justify-between gap-4"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--hv-border-subtle)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          <div>
            <div className="hv-label-sm" style={{ fontSize: 10 }}>Empezá desde</div>
            <div className="hv-mono" style={{ color: 'var(--hv-text)', fontSize: 18, fontWeight: 600 }}>
              {usd(t.precioTokenUsd, 2)} / HRV
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="hv-cta-ghost"
              style={{
                padding: '10px 16px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Seguir explorando
            </button>
            <Link
              to={`/invertir/${t.id}`}
              className="hv-cta"
              style={{
                textDecoration: 'none',
                padding: '11px 20px',
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Ver ficha y comprar
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 5l7 7-7 7M20 12H4" />
              </svg>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function KpiChip({
  icon,
  label,
  valor,
  sub,
  tono,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  sub?: string;
  tono?: 'verde' | 'amarillo' | 'rojo';
}) {
  const color =
    tono === 'rojo' ? 'var(--hv-red-text)' : tono === 'amarillo' ? 'var(--hv-amber-text)' : 'var(--hv-text)';
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--hv-border-subtle)',
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div className="hv-label-sm flex items-center gap-1.5" style={{ fontSize: 9 }}>
        <span style={{ color: 'var(--hv-text-muted)' }}>{icon}</span>
        {label}
      </div>
      <div className="hv-mono" style={{ color, fontSize: 18, fontWeight: 600, marginTop: 4, lineHeight: 1 }}>
        {valor}
      </div>
      {sub && <div style={{ color: 'var(--hv-text-muted)', fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ItemGarantia({ activo, label }: { activo: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 text-xs ${activo ? '' : 'opacity-40'}`}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: activo ? 'var(--hv-green-soft)' : 'rgba(255,255,255,0.05)',
          color: activo ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
          fontSize: 11,
          border: activo ? '1px solid rgba(43,224,106,0.2)' : '1px solid var(--hv-border-subtle)',
        }}
      >
        {activo ? '✓' : '·'}
      </span>
      <span style={{ color: activo ? 'var(--hv-text)' : 'var(--hv-text-muted)' }}>{label}</span>
    </div>
  );
}
