import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../services/tokenizadasService';
import { CardCampana } from '../components/marketplace/CardCampana';
import { usePreciosLive } from '../hooks/usePreciosLive';
import { TickerGrande } from '../components/precios/TickerGrande';
import { usdCompacto, porcentaje } from '../utils/format';
import { useWalletStore } from '../stores/walletStore';
import { HarvestLogo } from '../components/brand/HarvestLogo';
import { HomeInversorPage } from './inversor/HomeInversorPage';
import { HomeProductorPage } from './productor/HomeProductorPage';
import { LandingPublicaPage } from './LandingPublicaPage';
import { useAuthStore } from '@/stores/authStore';

/**
 * Dispatcher de la raíz `/`.
 *   - Sin sesión                  → LandingPublicaPage (marketing puro)
 *   - Con sesión productor         → HomeProductorPage
 *   - Con sesión inversor          → HomeInversorPage
 *   - Con sesión admin/acopio      → vista tickers + TVL + oráculo (fallback)
 */
export function HomePage() {
  const usuarioAuth = useAuthStore((s) => s.usuario);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const conectada = useWalletStore((s) => s.conectada);
  const ticks = usePreciosLive();

  if (!isAuthenticated) {
    return <LandingPublicaPage />;
  }
  if (usuarioAuth?.rolPlataforma === 'productor') {
    return <HomeProductorPage />;
  }
  if (usuarioAuth?.rolPlataforma === 'inversor') {
    return <HomeInversorPage />;
  }

  const { data: destacadas } = useQuery({
    queryKey: ['tk', 'destacadas'],
    queryFn: () => tokenizadasApi.marketplace({ orden: 'cierra_pronto' }),
  });

  // Métricas mock del hero
  const tvl = 4_872_340;
  const tvlCambio = 12.4;
  const campanasActivas = destacadas?.length ?? 0;
  const holders = 184;
  const tokensEmitidos = 986_000;

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
        <div>
          <div className="hv-label mb-3">Cosechas tokenizadas · Solana</div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
              color: 'var(--hv-text)',
            }}
          >
            La cosecha,{' '}
            <span style={{ color: 'var(--hv-green)' }}>líquida</span>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              marginTop: 20,
              fontSize: 16,
              lineHeight: 1.55,
              maxWidth: 620,
              color: 'var(--hv-text-2)',
            }}
          >
            El productor cobra hoy. El inversor cobra al cosechar. Todo asentado on-chain,
            colateralizado por producción real y validado por acopios habilitados.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            {!conectada ? (
              <div
                style={{
                  fontFamily: 'var(--hv-font-mono)',
                  fontSize: 13,
                  color: 'var(--hv-text-muted)',
                  border: '1px dashed var(--hv-border)',
                  borderRadius: 10,
                  padding: '12px 18px',
                }}
              >
                Conectá tu wallet para empezar
              </div>
            ) : (
              <>
                <Link to="/invertir" className="hv-cta" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 5l7 7-7 7M20 12H4" />
                  </svg>
                  Explorar marketplace
                </Link>
                <Link to="/portfolio" className="hv-cta-ghost" style={{ textDecoration: 'none' }}>
                  Mi portfolio
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Card TVL grande estilo hero derecha */}
        <div className="hv-glass hv-radial" style={{ borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div className="hv-label mb-2" style={{ fontSize: 10 }}>Valor tokenizado · TVL</div>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.035em', color: 'var(--hv-text)', lineHeight: 1 }}>
            {usdCompacto(tvl)}
          </div>
          <div className="flex items-center gap-2 mt-3" style={{ fontSize: 13, color: 'var(--hv-green-text)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 17L12 9l4 4 4-6" />
            </svg>
            <span className="hv-mono">{porcentaje(tvlCambio, 1)}</span>
            <span style={{ color: 'var(--hv-text-muted)' }}>vs. campaña anterior</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6" style={{ borderTop: '1px solid var(--hv-border-subtle)' }}>
            <MiniStat label="Emisiones" valor={campanasActivas.toString()} />
            <MiniStat label="Holders" valor={holders.toString()} />
            <MiniStat label="HRV total" valor={`${(tokensEmitidos / 1000).toFixed(0)}K`} />
          </div>
        </div>
      </section>

      {/* Precios en vivo */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
              Oráculo público
            </h2>
            <p className="hv-label-sm" style={{ marginTop: 4 }}>
              Pizarra Rosario · actualización on-chain cada 12 s
            </p>
          </div>
          <span className="hv-chip hv-chip-green" style={{ fontSize: 11 }}>
            <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
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
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
                Emisiones abiertas
              </h2>
              <p className="hv-label-sm" style={{ marginTop: 4 }}>
                Cierran pronto · descuento sobre pizarra
              </p>
            </div>
            <Link to="/invertir" style={{ color: 'var(--hv-green-text)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
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

      {/* Footer del hero — marca + tokens visibles */}
      <section
        className="hv-glass"
        style={{
          borderRadius: 20,
          padding: 32,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
          alignItems: 'center',
        }}
      >
        <div>
          <HarvestLogo variant="lockup-vertical" size={44} tagline />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ValueRow label="Token" value="HRV" mono />
          <ValueRow label="Red" value="Solana" />
          <ValueRow label="Stablecoin" value="USDC" mono />
          <ValueRow label="Colateral" value="Producción real" />
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div className="hv-mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--hv-text)', marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function ValueRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="hv-label-sm" style={{ fontSize: 10 }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? 'var(--hv-font-mono)' : 'var(--hv-font-sans)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--hv-text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

