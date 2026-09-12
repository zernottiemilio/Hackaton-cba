import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { camposApi } from '../../services/camposService';
import { hectareas } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';

// Lazy: Leaflet + tiles pesan ~180KB. Se comparte con el chunk del
// marketplace, es una sola descarga la primera vez que se necesita.
const MapaCampoPreview = lazy(() => import('../../components/mapa/MapaCampoPreview'));

/**
 * Listado de campos del productor. Cada card muestra una miniatura del
 * polígono sobre satélite (SVG derivado del GeoJSON) para hacer visible
 * el activo.
 */
export function CamposListPage() {
  const conectada = useWalletStore((s) => s.conectada);
  const { data: campos = [], isLoading } = useQuery({
    queryKey: ['tk', 'campos'],
    queryFn: () => camposApi.listar(),
    enabled: !!conectada,
  });

  if (!conectada) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <div className="text-5xl mb-4 opacity-70">⛰️</div>
        <h1 className="text-white text-2xl font-semibold mb-2">Conectá tu wallet</h1>
        <p className="text-white/40 text-sm">Necesitás una wallet para gestionar tus campos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Mis campos</h1>
          <p className="text-white/40 text-xs mt-0.5">
            {campos.length} {campos.length === 1 ? 'campo' : 'campos'} registrados
          </p>
        </div>
        <Link
          to="/campos/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30"
        >
          <span>＋</span> Nuevo campo
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#0F1216] border border-white/5 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      ) : campos.length === 0 ? (
        <EstadoVacio />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campos.map((c) => (
            <CampoCard key={c.id} campo={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampoCard({ campo }: { campo: any }) {
  const superficie = Number(campo.superficieTotalHa ?? 0);
  const campanias = campo.campaniasTokenizadas?.length ?? 0;
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Link
        to={`/campos/${campo.id}`}
        className="block bg-[#0F1216] border border-white/5 hover:border-white/15 rounded-2xl overflow-hidden transition-colors"
      >
        <div className="relative h-32 bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-lime-900/60 overflow-hidden">
          <Suspense fallback={<div className="absolute inset-0" />}>
            <MapaCampoPreview
              geometria={campo.geometria}
              latitud={campo.latitud}
              longitud={campo.longitud}
            />
          </Suspense>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
          <div className="absolute bottom-3 left-3 right-3">
            <div className="text-white font-semibold text-base leading-tight drop-shadow">{campo.nombre}</div>
            <div className="text-white/70 text-xs mt-0.5 drop-shadow">
              {campo.partido ?? '—'}, {campo.provincia ?? '—'}
            </div>
          </div>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="text-white text-lg font-semibold tabular-nums">{hectareas(superficie)}</div>
            <div className="text-white/40 text-[11px] mt-0.5 capitalize">{campo.tenencia}</div>
          </div>
          <div className="text-right">
            <div className="text-white/40 text-[10px] uppercase tracking-wider">Campañas</div>
            <div className="text-white tabular-nums text-lg font-semibold">{campanias}</div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function EstadoVacio() {
  return (
    <div className="text-center py-20 bg-[#0F1216] border border-white/5 rounded-2xl">
      <div className="text-4xl mb-3 opacity-60">⛰️</div>
      <div className="text-white text-lg font-medium mb-1">Aún no cargaste ningún campo</div>
      <p className="text-white/40 text-sm mb-6">Empezá dibujando tu primer lote sobre el mapa</p>
      <Link
        to="/campos/nuevo"
        className="inline-flex px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium"
      >
        Nuevo campo →
      </Link>
    </div>
  );
}
