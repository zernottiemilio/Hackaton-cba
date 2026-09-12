import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../services/tokenizadasService';
import { usd, usdTn, porcentaje, toneladas, hectareas, fecha, diasRestantes } from '../utils/format';
import { BadgeModo } from '../components/campana/BadgeModo';
import { EstadoCampanaBadge } from '../components/campana/EstadoCampanaBadge';
import { BarraFondeo } from '../components/campana/BarraFondeo';
import { PanelOnChain } from '../components/campana/PanelOnChain';
import { SeccionClima } from '../components/campana/SeccionClima';
import { SeccionSuelo } from '../components/campana/SeccionSuelo';
import { SeccionNdvi } from '../components/campana/SeccionNdvi';
import { SeccionSimuladorRetorno } from '../components/campana/SeccionSimuladorRetorno';
import { Sparkline } from '../components/charts/Sparkline';
import { useHistoriaPrecios, usePrecioLive } from '../hooks/usePreciosLive';
import { normalizarCultivo, type Cultivo } from '../services/mockPreciosService';
import { PanelCompra } from '../components/marketplace/PanelCompra';

export function FichaCampanaPage() {
  const { id = '' } = useParams();
  const { data: t, isLoading } = useQuery({
    queryKey: ['tk', 'campana', id],
    queryFn: () => tokenizadasApi.detalleMarketplace(id),
    enabled: !!id,
  });

  if (isLoading || !t) {
    return <div className="text-white/40 text-sm">Cargando campaña...</div>;
  }

  const cultivoNombre = normalizarCultivo(t.campania.cultivo?.nombre);
  const pctFondeado = t.tokensEmitidos > 0 ? (t.tokensVendidos / t.tokensEmitidos) * 100 : 0;
  const superficie = Number(t.campania.hectareasAfectadas ?? 0);
  const partido = t.campania.establecimiento?.partido ?? '—';
  const provincia = t.campania.establecimiento?.provincia ?? '—';
  const disponibles = t.disponibilidad?.tokensDisponibles ?? t.tokensEmitidos - t.tokensVendidos;
  // min_tons on-chain: sin este piso vendido, el programa no deja al productor cobrar (MinNotReached).
  const minimo = Number(t.toneladasMinimas ?? 1);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Volver */}
      <Link to="/invertir" className="text-white/40 hover:text-white/80 text-xs mb-4 inline-flex items-center gap-1">
        ← Cosechas
      </Link>

      {/* Hero: mapa a sangre */}
      <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-emerald-900/70 via-emerald-800/50 to-lime-900/70">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 100 60" preserveAspectRatio="none">
          <path
            d="M15,10 L60,8 L85,25 L88,45 L55,55 L20,50 Z"
            fill="rgba(255,255,255,0.1)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BadgeModo modo={t.modo} size="md" />
              {t.campania.estadoToken && <EstadoCampanaBadge estado={t.campania.estadoToken} />}
            </div>
            <h1 className="text-white text-3xl md:text-4xl font-semibold tracking-tight drop-shadow-lg">
              {t.campania.establecimiento?.nombre ?? t.campania.nombre}
            </h1>
            <p className="text-white/70 text-sm mt-1 drop-shadow">
              {t.campania.cultivo?.nombre} · {hectareas(superficie)} · {partido}, {provincia}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-white/60 text-xs">Cosecha estimada</div>
            <div className="text-white text-lg font-medium tabular-nums drop-shadow">
              {t.campania.fechaCosechaEstimada ? fecha(t.campania.fechaCosechaEstimada) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Layout dos columnas: narrativa + panel compra sticky */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          {/* Métricas principales */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Metrica label="Precio por token" valor={usd(t.precioTokenUsd, 2)} sub={`${porcentaje(-t.descuentoPct, 1)} pizarra`} destacado />
            <Metrica label="Toneladas ofrecidas" valor={toneladas(t.toneladasOfrecidas, 0)} sub={t.modo === 'porcentual' ? `${t.porcentaje}% producción` : 'Cantidad fija'} />
            <Metrica label="Disponibles" valor={toneladas(disponibles, 0)} sub={`${pctFondeado.toFixed(0)}% fondeado`} />
            <Metrica
              label="Mínimo a fondear"
              valor={toneladas(minimo, 0)}
              sub={
                t.tokensVendidos >= minimo
                  ? 'alcanzado · el productor ya puede cobrar'
                  : `faltan ${toneladas(minimo - t.tokensVendidos, 0)} · si no se llega, no se libera`
              }
            />
            <Metrica label="Cierra en" valor={diasRestantes(t.fondeoHasta)} sub={fecha(t.fondeoHasta)} />
          </div>

          {/* Barra de fondeo */}
          <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
            <div className="flex justify-between items-baseline mb-3">
              <h3 className="text-white font-semibold text-sm">Progreso de fondeo</h3>
              <span className="text-white/40 text-xs tabular-nums">
                {toneladas(t.tokensVendidos, 0)} / {toneladas(t.tokensEmitidos, 0)}
              </span>
            </div>
            <BarraFondeo vendidos={t.tokensVendidos} emitidos={t.tokensEmitidos} minimo={minimo} />
            <div className="flex justify-between items-baseline mt-3 text-xs">
              <span className="text-white/60">Recaudado</span>
              <span className="text-white font-semibold tabular-nums">{usd(t.montoRecaudadoUsd, 0)}</span>
            </div>
            <div className="flex justify-between items-baseline mt-1 text-xs">
              <span className="text-white/40">Objetivo</span>
              <span className="text-white/60 tabular-nums">{usd(t.montoObjetivoUsd, 0)}</span>
            </div>
          </div>

          {/* Gráfico de pizarra + serie precio token */}
          <SeccionPrecioPizarra cultivo={cultivoNombre} precioReferencia={t.precioReferenciaUsdTn} precioToken={t.precioTokenUsd} />

          {/* Clima */}
          <SeccionClima tokenizacionId={t.id} />

          {/* Suelo */}
          <SeccionSuelo tokenizacionId={t.id} />

          {/* NDVI */}
          <SeccionNdvi tokenizacionId={t.id} />

          {/* Simulador de retorno */}
          <SeccionSimuladorRetorno t={t} />

          {/* Garantías */}
          <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-3">Garantías</h3>
            <div className="space-y-2">
              <ItemGarantia activo={t.tieneSeguroGranizo} label="Seguro contra granizo" />
              <ItemGarantia activo={t.tieneSeguroParametrico} label="Seguro paramétrico (déficit hídrico)" />
              <ItemGarantia activo={t.tieneAvalSgr} label="Aval de SGR" />
              {t.sobrecolateralPct > 0 && (
                <ItemGarantia activo label={`Sobrecolateralización ${t.sobrecolateralPct}%`} />
              )}
            </div>
          </div>

          {/* El productor */}
          <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-3">El productor</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-semibold">
                {t.productor.nombre[0]}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{t.productor.nombre}</div>
                <div className="text-white/40 text-[11px]">{partido}, {provincia}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Panel de compra sticky + on-chain debajo (columna derecha) */}
        <div className="lg:sticky lg:top-6 h-fit space-y-4">
          <PanelCompra tokenizacion={t} disponibles={disponibles} />
          <PanelOnChain tokenizacionId={t.id} />
        </div>
      </div>
    </div>
  );
}

function Metrica({ label, valor, sub, destacado }: { label: string; valor: string; sub?: string; destacado?: boolean }) {
  return (
    <div className={`bg-[#0F1216] border rounded-xl p-3 ${destacado ? 'border-emerald-500/30' : 'border-white/5'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">{label}</div>
      <div className="text-xl font-semibold text-white tabular-nums leading-tight">{valor}</div>
      {sub && <div className="text-white/40 text-[10px] mt-1">{sub}</div>}
    </div>
  );
}

function SeccionPrecioPizarra({ cultivo, precioReferencia, precioToken }: { cultivo: Cultivo; precioReferencia: number; precioToken: number }) {
  const historia = useHistoriaPrecios(cultivo, 60);
  const live = usePrecioLive(cultivo);
  const spread = ((live.usdTn - precioToken) / precioToken) * 100;

  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
      <div className="flex justify-between items-baseline mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Precio de pizarra</h3>
          <p className="text-white/40 text-xs mt-0.5 capitalize">{cultivo} · Rosario</p>
        </div>
        <div className="text-right">
          <div className="text-white text-xl font-semibold tabular-nums">{usdTn(live.usdTn)}</div>
          <div className={`text-xs tabular-nums ${live.cambio24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {porcentaje(live.cambio24hPct, 2)}
          </div>
        </div>
      </div>
      <div className="mb-3">
        <Sparkline data={historia.map((h) => h.usdTn)} width={640} height={80} strokeWidth={2} />
      </div>
      <div className="pt-3 border-t border-white/5 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-white/40">Precio token</div>
          <div className="text-white font-medium tabular-nums">{usd(precioToken, 2)}</div>
        </div>
        <div>
          <div className="text-white/40">Precio pizarra</div>
          <div className="text-white font-medium tabular-nums">{usd(precioReferencia, 2)}</div>
        </div>
        <div>
          <div className="text-white/40">Gap actual</div>
          <div className={`font-semibold tabular-nums ${spread >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {porcentaje(spread, 1)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemGarantia({ activo, label }: { activo: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 text-sm ${activo ? 'text-white' : 'text-white/30'}`}>
      <span className={`w-5 h-5 rounded flex items-center justify-center ${activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5'}`}>
        {activo ? '✓' : '·'}
      </span>
      <span>{label}</span>
    </div>
  );
}

