import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { camposApi } from '../../services/camposService';
import { hectareas } from '../../utils/format';
import { useWalletStore } from '../../stores/walletStore';

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
          to="/tk/campos/nuevo"
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
        to={`/tk/campos/${campo.id}`}
        className="block bg-[#0F1216] border border-white/5 hover:border-white/15 rounded-2xl overflow-hidden transition-colors"
      >
        <div className="relative h-32 bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-lime-900/60 overflow-hidden">
          <MiniaturaPoligono geometria={campo.geometria} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
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

/**
 * SVG con el polígono normalizado a 100x60. No usa Leaflet — es una
 * miniatura estática rápida para cards. Perfecta para grillas grandes
 * donde montar 30 mapas Leaflet mataría el navegador.
 */
function MiniaturaPoligono({ geometria }: { geometria: GeoJSON.Polygon | null }) {
  if (!geometria || !geometria.coordinates?.[0]?.length) {
    return (
      <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full opacity-30">
        <path
          d="M15,10 L60,8 L85,25 L88,45 L55,55 L20,50 Z"
          fill="rgba(255,255,255,0.1)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.5"
        />
      </svg>
    );
  }
  const coords = geometria.coordinates[0];
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanLng = maxLng - minLng || 1;
  const spanLat = maxLat - minLat || 1;
  const pad = 6;
  const w = 100 - pad * 2;
  const h = 60 - pad * 2;
  const scale = Math.min(w / spanLng, h / spanLat);
  const offX = (100 - spanLng * scale) / 2;
  const offY = (60 - spanLat * scale) / 2;

  const puntos = coords
    .map(([lng, lat]) => `${(lng - minLng) * scale + offX},${(maxLat - lat) * scale + offY}`)
    .join(' ');

  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100" height="60" fill="url(#grid)" />
      <polygon
        points={puntos}
        fill="rgba(22, 199, 132, 0.25)"
        stroke="rgba(22, 199, 132, 0.9)"
        strokeWidth="0.8"
      />
    </svg>
  );
}

function EstadoVacio() {
  return (
    <div className="text-center py-20 bg-[#0F1216] border border-white/5 rounded-2xl">
      <div className="text-4xl mb-3 opacity-60">⛰️</div>
      <div className="text-white text-lg font-medium mb-1">Aún no cargaste ningún campo</div>
      <p className="text-white/40 text-sm mb-6">Empezá dibujando tu primer lote sobre el mapa</p>
      <Link
        to="/tk/campos/nuevo"
        className="inline-flex px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium"
      >
        Nuevo campo →
      </Link>
    </div>
  );
}
