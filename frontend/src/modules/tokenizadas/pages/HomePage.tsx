import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../services/tokenizadasService';
import { CardCampana } from '../components/marketplace/CardCampana';
import { usePreciosLive } from '../hooks/usePreciosLive';
import { Sparkline } from '../components/charts/Sparkline';
import { useHistoriaPrecios } from '../hooks/usePreciosLive';
import { usd, porcentaje, usdCompacto } from '../utils/format';
import { useWalletStore } from '../stores/walletStore';
import type { Cultivo } from '../services/mockPreciosService';

export function HomePage() {
  const conectada = useWalletStore((s) => s.conectada);
  const ticks = usePreciosLive();

  const { data: destacadas } = useQuery({
    queryKey: ['tk', 'destacadas'],
    queryFn: () => tokenizadasApi.marketplace({ orden: 'cierra_pronto' }),
  });

  // Métricas mock del hero (a la izquierda)
  const tvl = 4_872_340; // Total Value Locked mock
  const tvlCambio = 12.4;
  const campanasActivas = destacadas?.length ?? 0;
  const inversores = 127;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero: título + métricas globales */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-[1.05]"
          >
            Invertí en el <span className="text-emerald-400">grano</span> antes de que se coseche.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-white/60 text-base max-w-2xl leading-relaxed"
          >
            Campañas agropecuarias reales, tokenizadas sobre Solana. El productor
            recibe capital hoy; vos recibís producción a precio de descuento cuando cosecha.
            Sin bancos, sin intermediarios.
          </motion.p>
          <div className="mt-6 flex flex-wrap gap-3">
            {!conectada ? (
              <div className="text-white/40 text-sm italic px-4 py-2 border border-white/10 rounded-lg">
                Conectá tu wallet para operar
              </div>
            ) : (
              <>
                <Link
                  to="/tk/invertir"
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/40 transition-all"
                >
                  Explorar marketplace →
                </Link>
                <Link
                  to="/tk/portfolio"
                  className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all"
                >
                  Mi portfolio
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="TVL" valor={usdCompacto(tvl)} cambio={tvlCambio} />
          <StatCard label="Campañas" valor={campanasActivas.toString()} />
          <StatCard label="Inversores" valor={inversores.toString()} />
          <StatCard label="Tokens emitidos" valor="8.4K tn" />
        </div>
      </section>

      {/* Precios en vivo — grid grande de tickers */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-white text-xl font-semibold">Mercado en vivo</h2>
            <p className="text-white/40 text-xs mt-0.5">Pizarra de Rosario · Actualiza cada 3–5s</p>
          </div>
          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            en vivo
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ticks.map((t) => (
            <TickerGrande key={t.cultivo} cultivo={t.cultivo} usdTn={t.usdTn} cambio={t.cambio24hPct} />
          ))}
        </div>
      </section>

      {/* Cards destacadas */}
      {destacadas && destacadas.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-white text-xl font-semibold">Campañas que cierran pronto</h2>
            <Link to="/tk/invertir" className="text-emerald-400 text-xs font-medium hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {destacadas.slice(0, 6).map((t) => (
              <CardCampana key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, valor, cambio }: { label: string; valor: string; cambio?: number }) {
  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-xl p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">{label}</div>
      <div className="text-xl font-semibold text-white tabular-nums">{valor}</div>
      {cambio !== undefined && (
        <div className={`text-[11px] tabular-nums mt-1 ${cambio >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {porcentaje(cambio, 1)} <span className="text-white/30">24h</span>
        </div>
      )}
    </div>
  );
}

function TickerGrande({ cultivo, usdTn, cambio }: { cultivo: Cultivo; usdTn: number; cambio: number }) {
  const historia = useHistoriaPrecios(cultivo, 40);
  const nombre = { soja: 'Soja', maiz: 'Maíz', trigo: 'Trigo', girasol: 'Girasol' }[cultivo];
  const emoji = { soja: '🫘', maiz: '🌽', trigo: '🌾', girasol: '🌻' }[cultivo];

  return (
    <div className="bg-[#0F1216] border border-white/5 hover:border-white/15 rounded-xl p-4 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <span className="text-white font-medium text-sm">{nombre}</span>
        </div>
        <span className="text-[10px] text-white/30 font-medium">USD/TN</span>
      </div>
      <div className="text-2xl font-semibold text-white tabular-nums mb-1">{usd(usdTn, 2)}</div>
      <div className="flex items-center justify-between">
        <span className={`tabular-nums text-xs font-medium ${cambio >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {porcentaje(cambio, 2)}
        </span>
        <Sparkline data={historia.map((h) => h.usdTn)} width={80} height={24} />
      </div>
    </div>
  );
}
