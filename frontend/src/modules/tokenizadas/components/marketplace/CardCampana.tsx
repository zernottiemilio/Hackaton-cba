import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Tokenizacion } from '../../types/tokenizadas';
import { BadgeModo } from '../campana/BadgeModo';
import { BarraFondeo } from '../campana/BarraFondeo';
import { Sparkline } from '../charts/Sparkline';
import { useHistoriaPrecios } from '../../hooks/usePreciosLive';
import { diasRestantes, fechaCorta, hectareas, porcentaje, toneladas, usd, usdTn } from '../../utils/format';
import type { Cultivo } from '../../services/mockPreciosService';

interface Props {
  t: Tokenizacion;
}

/**
 * Card de emisión en el marketplace — estética Harvest.fi.
 * Header con miniatura del lote, badge de modo y estado de urgencia.
 * Body con precio HRV, sparkline, barra de fondeo y meta.
 */
export function CardCampana({ t }: Props) {
  const cultivoNombre = (t.campania.cultivo?.nombre?.toLowerCase() ?? 'soja') as Cultivo;
  const historia = useHistoriaPrecios(cultivoNombre, 40);
  const precioReferenciaSpark = historia.map((h) => h.usdTn);

  const ultimoReferencia = historia.length > 0 ? historia[historia.length - 1].usdTn : t.precioReferenciaUsdTn;
  const primeroReferencia = historia.length > 0 ? historia[0].usdTn : t.precioReferenciaUsdTn;
  const cambioReferenciaPct = ((ultimoReferencia - primeroReferencia) / primeroReferencia) * 100;

  const pctFondeado = t.tokensEmitidos > 0 ? (t.tokensVendidos / t.tokensEmitidos) * 100 : 0;
  const provincia = t.campania.establecimiento?.provincia ?? '—';
  const partido = t.campania.establecimiento?.partido ?? '—';
  const superficie = t.campania.hectareasAfectadas ?? 0;
  const cierraPronto = new Date(t.fondeoHasta).getTime() - Date.now() < 48 * 3600 * 1000;
  const up = cambioReferenciaPct >= 0;

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="group">
      <Link
        to={`/tk/invertir/${t.id}`}
        style={{
          display: 'block',
          background: 'var(--hv-bg-panel)',
          border: '1px solid var(--hv-border)',
          borderRadius: 18,
          overflow: 'hidden',
          textDecoration: 'none',
          transition: 'border-color 150ms ease',
          boxShadow: 'var(--hv-inset-top)',
        }}
      >
        {/* Hero con polígono decorativo */}
        <div
          style={{
            position: 'relative',
            height: 150,
            background: 'linear-gradient(135deg, rgba(10,107,18,0.55) 0%, rgba(43,224,106,0.15) 100%)',
            overflow: 'hidden',
            borderBottom: '1px solid var(--hv-border-subtle)',
          }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 100 60" preserveAspectRatio="none">
            <path
              d="M15,10 L60,8 L85,25 L88,45 L55,55 L20,50 Z"
              fill="rgba(43,224,106,0.12)"
              stroke="rgba(43,224,106,0.55)"
              strokeWidth="0.5"
              strokeDasharray="1.5,1"
            />
          </svg>
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <BadgeModo modo={t.modo} />
            {cierraPronto && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: 'var(--hv-amber)',
                  color: 'var(--hv-bg-token)',
                  fontFamily: 'var(--hv-font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  animation: 'hv-pulse 2s ease-out infinite',
                }}
              >
                cierra pronto
              </span>
            )}
          </div>
          <div className="absolute bottom-3 left-4 right-4">
            <div style={{ color: 'var(--hv-text)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
              {t.campania.establecimiento?.nombre ?? t.campania.nombre}
            </div>
            <div
              className="hv-mono"
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.75)',
                marginTop: 3,
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {t.campania.cultivo?.nombre ?? '—'} · {hectareas(Number(superficie))} · {partido}, {provincia}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 18 }} className="space-y-4">
          {/* Precio */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="hv-label-sm" style={{ fontSize: 10, marginBottom: 4 }}>
                Precio HRV
              </div>
              <div
                className="hv-mono"
                style={{ fontSize: 24, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em', lineHeight: 1 }}
              >
                {usd(t.precioTokenUsd, 2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--hv-text-muted)', marginTop: 4 }}>
                <span className="hv-mono" style={{ color: 'var(--hv-green-text)' }}>
                  {porcentaje(-t.descuentoPct, 1)}
                </span>{' '}
                vs pizarra{' '}
                <span className="hv-mono">{usdTn(t.precioReferenciaUsdTn)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <Sparkline data={precioReferenciaSpark} width={72} height={28} />
              <div
                className="hv-mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  marginTop: 4,
                  color: up ? 'var(--hv-green-text)' : 'var(--hv-red-text)',
                }}
              >
                {porcentaje(cambioReferenciaPct, 2)}
              </div>
            </div>
          </div>

          {/* Fondeo */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="hv-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hv-text)' }}>
                  {pctFondeado.toFixed(0)}%
                </span>
                <span className="hv-label-sm" style={{ fontSize: 9 }}>
                  Fondeado
                </span>
              </div>
              <span className="hv-mono" style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
                {toneladas(t.tokensVendidos, 0)} / {toneladas(t.tokensEmitidos, 0)}
              </span>
            </div>
            <BarraFondeo vendidos={t.tokensVendidos} emitidos={t.tokensEmitidos} compacta />
          </div>

          {/* Meta */}
          <div className="pt-3 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
            <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--hv-text-muted)' }}>
              <span>
                <span className="hv-label-sm" style={{ fontSize: 9, marginRight: 4 }}>
                  cierra
                </span>
                <span className="hv-mono" style={{ color: 'var(--hv-text)', fontWeight: 600 }}>
                  {diasRestantes(t.fondeoHasta)}
                </span>
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--hv-border-strong)' }} />
              <span>
                <span className="hv-label-sm" style={{ fontSize: 9, marginRight: 4 }}>
                  cosecha
                </span>
                <span className="hv-mono" style={{ color: 'var(--hv-text-2)', fontWeight: 600 }}>
                  {t.campania.fechaCosechaEstimada ? fechaCorta(t.campania.fechaCosechaEstimada) : '—'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              {t.tieneSeguroGranizo && <BadgeGarantia icon="❄" title="Seguro granizo" />}
              {t.tieneSeguroParametrico && <BadgeGarantia icon="⚡" title="Paramétrico" />}
              {t.tieneAvalSgr && <BadgeGarantia icon="✓" title="Aval SGR" />}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function BadgeGarantia({ icon, title }: { icon: string; title: string }) {
  return (
    <span
      title={title}
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
      {icon}
    </span>
  );
}
