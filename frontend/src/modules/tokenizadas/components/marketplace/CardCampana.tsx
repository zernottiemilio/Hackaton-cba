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
 * Card de campaña en el marketplace. La miniatura es el polígono del lote
 * sobre satélite (por ahora placeholder gradiente hasta que integremos
 * `MiniaturaLote`).
 *
 * Diseño estilo card de Binance: precio grande, sparkline, cambio %,
 * barra de fondeo, badges. Toda la card es clickable.
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

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      className="group relative"
    >
      <Link
        to={`/tk/invertir/${t.id}`}
        className="block bg-[#0F1216] border border-white/5 hover:border-white/15 rounded-2xl overflow-hidden transition-colors"
      >
        {/* Hero: miniatura + badges superpuestos */}
        <div className="relative h-40 bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-lime-900/60 overflow-hidden">
          {/* Pattern de grilla sutil */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Silueta de polígono decorativa */}
          <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 60" preserveAspectRatio="none">
            <path
              d="M15,10 L60,8 L85,25 L88,45 L55,55 L20,50 Z"
              fill="rgba(255,255,255,0.1)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.5"
            />
          </svg>
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <BadgeModo modo={t.modo} />
            </div>
            {cierraPronto && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-rose-500/90 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse">
                🔥 Cierra pronto
              </span>
            )}
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="text-white text-lg font-semibold leading-tight drop-shadow-lg">
              {t.campania.establecimiento?.nombre ?? t.campania.nombre}
            </div>
            <div className="text-white/80 text-xs mt-0.5 drop-shadow">
              {t.campania.cultivo?.nombre ?? 'Cultivo'} · {hectareas(Number(superficie))} · {partido}, {provincia}
            </div>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-4 space-y-3">
          {/* Fila 1: Precio + cambio referencia (estilo Binance) */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                Precio por token
              </div>
              <div className="text-2xl font-semibold text-white tabular-nums leading-none">
                {usd(t.precioTokenUsd, 2)}
              </div>
              <div className="text-[11px] text-white/40 mt-1">
                {porcentaje(-t.descuentoPct, 1)} vs pizarra{' '}
                <span className="text-white/60 tabular-nums">{usdTn(t.precioReferenciaUsdTn)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <Sparkline data={precioReferenciaSpark} width={72} height={28} />
              <div
                className={`tabular-nums text-[11px] font-medium mt-1 ${
                  cambioReferenciaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {porcentaje(cambioReferenciaPct, 2)}
              </div>
            </div>
          </div>

          {/* Fila 2: Barra de fondeo */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-white tabular-nums">
                  {pctFondeado.toFixed(0)}%
                </span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Fondeado</span>
              </div>
              <span className="text-[11px] text-white/40 tabular-nums">
                {toneladas(t.tokensVendidos, 0)} / {toneladas(t.tokensEmitidos, 0)}
              </span>
            </div>
            <BarraFondeo vendidos={t.tokensVendidos} emitidos={t.tokensEmitidos} compacta />
          </div>

          {/* Fila 3: Métricas + garantías */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[11px] text-white/50">
              <span className="tabular-nums">
                <span className="text-white/30">Cierra</span>{' '}
                <span className="text-white/80 font-medium">{diasRestantes(t.fondeoHasta)}</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="tabular-nums">
                <span className="text-white/30">Cosecha</span>{' '}
                <span className="text-white/80 font-medium">
                  {t.campania.fechaCosechaEstimada ? fechaCorta(t.campania.fechaCosechaEstimada) : '—'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {t.tieneSeguroGranizo && (
                <span title="Seguro granizo" className="w-5 h-5 rounded bg-sky-500/15 text-sky-400 flex items-center justify-center text-[10px]">
                  ❄
                </span>
              )}
              {t.tieneSeguroParametrico && (
                <span title="Seguro paramétrico" className="w-5 h-5 rounded bg-purple-500/15 text-purple-400 flex items-center justify-center text-[10px]">
                  ⚡
                </span>
              )}
              {t.tieneAvalSgr && (
                <span title="Aval SGR" className="w-5 h-5 rounded bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-[10px]">
                  ✓
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
