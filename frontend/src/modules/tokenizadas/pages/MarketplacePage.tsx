import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi, type FiltrosMarketplace } from '../services/tokenizadasService';
import { CardCampana } from '../components/marketplace/CardCampana';
import type { ModoTokenizacion } from '../types/tokenizadas';

const CULTIVOS = ['soja', 'maiz', 'trigo', 'girasol'];
const PROVINCIAS = ['Buenos Aires', 'Córdoba', 'Santa Fe', 'La Pampa'];

export function MarketplacePage() {
  const [filtros, setFiltros] = useState<FiltrosMarketplace>({ orden: 'cierra_pronto' });

  const { data: campanias = [], isLoading } = useQuery({
    queryKey: ['tk', 'marketplace', filtros],
    queryFn: () => tokenizadasApi.marketplace(filtros),
  });

  const setF = <K extends keyof FiltrosMarketplace>(k: K, v: FiltrosMarketplace[K]) =>
    setFiltros((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header + orden */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Marketplace</h1>
          <p className="text-white/40 text-xs mt-0.5">{campanias.length} campañas abiertas para invertir</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">Ordenar</span>
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
        {/* Filtros */}
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
            <div className="px-2 pt-1">
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

        {/* Grid de cards */}
        <div>
          {isLoading ? (
            <SkeletonGrid />
          ) : campanias.length === 0 ? (
            <EstadoVacio onReset={() => setFiltros({ orden: 'cierra_pronto' })} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {campanias.map((t) => (
                <CardCampana key={t.id} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-[#0F1216] border border-white/5 rounded-2xl overflow-hidden">
          <div className="h-40 bg-white/5 animate-pulse" />
          <div className="p-4 space-y-3">
            <div className="h-6 w-24 bg-white/5 rounded animate-pulse" />
            <div className="h-2 bg-white/5 rounded animate-pulse" />
            <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EstadoVacio({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-20 bg-[#0F1216] border border-white/5 rounded-2xl">
      <div className="text-4xl mb-3 opacity-60">🌾</div>
      <div className="text-white text-lg font-medium mb-1">Sin campañas con estos filtros</div>
      <p className="text-white/40 text-sm mb-6">Probá aflojando algún filtro para ver más resultados</p>
      <button
        onClick={onReset}
        className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
