import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { useAuthStore } from '@/stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import { CardCampana } from '../../components/marketplace/CardCampana';
import { BarraFondeo } from '../../components/campana/BarraFondeo';
import { EstadoCampanaBadge } from '../../components/campana/EstadoCampanaBadge';
import { BadgeModo } from '../../components/campana/BadgeModo';
import { BotonCobrarSiembra } from '../../components/campana/BotonCobrarSiembra';
import { HarvestLogo } from '../../components/brand/HarvestLogo';
import { usd, usdCompacto, toneladas, fecha, diasRestantes } from '../../utils/format';
import type { Tokenizacion } from '../../types/tokenizadas';
import type { EstadoCampanaToken } from '../../types/tokenizadas';

/**
 * Home del rol PRODUCTOR.
 * Consume GET /tokenizadas/mis-campanas y arma:
 *  - Header: saludo + wallet chip
 *  - Métricas hero: HRV emitidos, USDC recaudado, inversores, próxima cosecha
 *  - CTA grande "Tokenizar nueva campaña"
 *  - Grid de emisiones activas (agrupadas por estado)
 *  - Widget Asistente IA
 */
export function HomeProductorPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const walletBalance = useWalletStore((s) => s.conectada?.balanceUsdc);

  const { data: emisiones = [], isLoading } = useQuery({
    queryKey: ['tk', 'mis-campanas'],
    queryFn: () => tokenizadasApi.misCampanas(),
    enabled: !!usuario,
  });

  const metricas = calcularMetricas(emisiones);
  const nombre = usuario?.nombre.split(' ')[0] ?? 'Productor';

  const activas = emisiones.filter((e) => estadoEsActivo(e.campania.estadoToken));
  const paraCobrar = emisiones.filter(
    (e) => e.campania.estadoToken === 'abierta' && Number(e.tokensVendidos) >= Number(e.toneladasMinimas ?? 1),
  );
  const enRevision = emisiones.filter((e) => e.campania.estadoToken === 'en_revision');
  const borradores = emisiones.filter((e) => e.campania.estadoToken === 'borrador');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header con saludo + wallet */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="hv-label" style={{ fontSize: 10 }}>
            Panel del productor · Solana devnet
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              color: 'var(--hv-text)',
              marginTop: 6,
            }}
          >
            Hola {nombre}
          </motion.h1>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 14, marginTop: 6, maxWidth: 500 }}>
            {emisiones.length === 0
              ? 'Todavía no tenés emisiones. Empezá tokenizando una campaña.'
              : `${activas.length} emisiones activas · ${emisiones.length - activas.length} en historial`}
          </p>
        </div>
        {walletBalance !== undefined && (
          <div
            className="hv-glass hv-radial"
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              minWidth: 220,
            }}
          >
            <div className="hv-label-sm" style={{ fontSize: 9, marginBottom: 4 }}>
              Balance disponible
            </div>
            <div
              className="hv-mono"
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--hv-text)',
                letterSpacing: '-0.02em',
              }}
            >
              {usd(walletBalance, 2)}
            </div>
            <div
              className="hv-mono"
              style={{ fontSize: 10, color: 'var(--hv-green-text)', marginTop: 4 }}
            >
              USDC
            </div>
          </div>
        )}
      </section>

      {/* Métricas hero */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricaCard
          label="HRV emitidos"
          valor={toneladas(metricas.hrvEmitidos, 0)}
          sub={`${activas.length} campañas activas`}
          accent="green"
        />
        <MetricaCard
          label="USDC recaudado"
          valor={usdCompacto(metricas.usdcRecaudado)}
          sub={`${metricas.hrvVendidos.toFixed(0)} HRV vendidos`}
          accent="green"
          destacado
        />
        <MetricaCard
          label="Inversores"
          valor={metricas.inversores.toString()}
          sub={metricas.inversores === 1 ? 'wallet holder' : 'wallets holders'}
        />
        <MetricaCard
          label="Próxima cosecha"
          valor={metricas.proximaCosecha ? fecha(metricas.proximaCosecha) : '—'}
          sub={metricas.proximaCosecha ? diasRestantes(metricas.proximaCosecha) : ''}
        />
      </section>

      {/* CTA grande */}
      <section
        className="hv-glass hv-radial flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{
          borderRadius: 20,
          padding: 28,
          boxShadow: 'var(--hv-inset-top)',
        }}
      >
        <div className="flex-1">
          <div className="hv-label" style={{ fontSize: 10, color: 'var(--hv-green-text)' }}>
            Nueva emisión
          </div>
          <h3
            style={{
              color: 'var(--hv-text)',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              marginTop: 6,
            }}
          >
            Tokenizá tu próxima campaña
          </h3>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 6, maxWidth: 480 }}>
            Wizard de 4 pasos: elegís el campo, decidís cuánto y cómo tokenizar (fijo o
            porcentual), cotizás con descuento sobre pizarra, sumás garantías. Al enviar,
            un admin la revisa y aparece en el marketplace público.
          </p>
        </div>
        <Link
          to="/campanas/nueva"
          className="hv-cta"
          style={{
            textDecoration: 'none',
            padding: '13px 22px',
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tokenizar campaña
        </Link>
      </section>

      {/* Para cobrar: paso 4 de la demo (release_funds) */}
      {paraCobrar.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em' }}>
                Listas para cobrar
              </h2>
              <p className="hv-label-sm" style={{ marginTop: 4 }}>
                Alcanzaron el mínimo. El vault espera tu firma.
              </p>
            </div>
            <span className="hv-chip" style={{ fontSize: 11, color: 'var(--hv-green-text)', borderColor: 'rgba(43,224,106,0.28)', background: 'var(--hv-green-soft)' }}>
              <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
              {paraCobrar.length}
            </span>
          </div>
          <div className="space-y-2">
            {paraCobrar.map((t) => (
              <FilaParaCobrar key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* En revisión */}
      {enRevision.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: 'var(--hv-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                Esperando aprobación
              </h2>
              <p className="hv-label-sm" style={{ marginTop: 4 }}>
                Un admin las revisa antes de publicarlas al marketplace
              </p>
            </div>
            <span className="hv-chip hv-chip-amber" style={{ fontSize: 11 }}>
              <span className="hv-dot" style={{ background: 'var(--hv-amber)' }} />
              {enRevision.length}
            </span>
          </div>
          <div className="space-y-2">
            {enRevision.map((e) => (
              <FilaEmisionPendiente key={e.id} t={e} />
            ))}
          </div>
        </section>
      )}

      {/* Emisiones activas */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--hv-text)',
                letterSpacing: '-0.02em',
              }}
            >
              Emisiones activas
            </h2>
            <p className="hv-label-sm" style={{ marginTop: 4 }}>
              Fondeo en curso · click para ver detalle
            </p>
          </div>
          <Link
            to="/campanas"
            style={{
              color: 'var(--hv-green-text)',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Ver todas →
          </Link>
        </div>
        {isLoading ? (
          <SkeletonGrid />
        ) : activas.length === 0 ? (
          <EstadoVacio />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activas.slice(0, 6).map((t) => (
              <CardCampana key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      {/* Borradores */}
      {borradores.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--hv-text-2)',
                letterSpacing: '-0.02em',
              }}
            >
              Borradores
            </h2>
            <span className="hv-label-sm">{borradores.length} sin publicar</span>
          </div>
          <div className="space-y-2">
            {borradores.map((e) => (
              <FilaEmisionPendiente key={e.id} t={e} />
            ))}
          </div>
        </section>
      )}

      {/* Widget Asistente IA */}
      <section
        className="hv-glass flex items-center gap-4"
        style={{
          borderRadius: 16,
          padding: 20,
          background:
            'linear-gradient(90deg, rgba(43,224,106,0.06), rgba(43,224,106,0.02))',
          border: '1px solid rgba(43,224,106,0.18)',
        }}
      >
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'rgba(43,224,106,0.15)',
            border: '1px solid rgba(43,224,106,0.3)',
          }}
        >
          <HarvestLogo variant="mark" size={32} animated />
        </div>
        <div className="flex-1">
          <div className="hv-label" style={{ fontSize: 10 }}>
            Agente Harvest
          </div>
          <h4
            style={{
              color: 'var(--hv-text)',
              fontSize: 15,
              fontWeight: 600,
              marginTop: 3,
            }}
          >
            ¿Dudas sobre cómo tokenizar tu campaña?
          </h4>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 3 }}>
            Preguntale al agente sobre precios, garantías, fondeo o cualquier otra cosa.
          </p>
        </div>
        <Link
          to="/asistente"
          className="hv-cta-ghost"
          style={{
            textDecoration: 'none',
            padding: '10px 16px',
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Abrir chat
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </section>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function estadoEsActivo(e: EstadoCampanaToken | null): boolean {
  return e === 'abierta' || e === 'fondeada' || e === 'en_curso' || e === 'en_cosecha';
}

function calcularMetricas(emisiones: Tokenizacion[]) {
  const activas = emisiones.filter((e) => estadoEsActivo(e.campania.estadoToken));
  const hrvEmitidos = activas.reduce((s, e) => s + Number(e.tokensEmitidos), 0);
  const hrvVendidos = activas.reduce((s, e) => s + Number(e.tokensVendidos), 0);
  const usdcRecaudado = emisiones.reduce((s, e) => s + Number(e.montoRecaudadoUsd), 0);

  // Inversores únicos: contamos wallets que aparecen en tenencias.
  const wallets = new Set<string>();
  emisiones.forEach((e) => {
    const tenencias = (e as unknown as { tenencias?: { walletAddress?: string }[] }).tenencias;
    tenencias?.forEach((t) => {
      if (t.walletAddress) wallets.add(t.walletAddress);
    });
  });

  const cosechasFuturas = activas
    .map((e) => e.campania.fechaCosechaEstimada)
    .filter((f): f is string => !!f && new Date(f).getTime() > Date.now())
    .sort();
  const proximaCosecha = cosechasFuturas[0] ?? null;

  return {
    hrvEmitidos,
    hrvVendidos,
    usdcRecaudado,
    inversores: wallets.size,
    proximaCosecha,
  };
}

// ─── Sub-components ──────────────────────────────────────────────

function MetricaCard({
  label,
  valor,
  sub,
  accent,
  destacado,
}: {
  label: string;
  valor: string;
  sub?: string;
  accent?: 'green';
  destacado?: boolean;
}) {
  return (
    <div
      className="hv-glass"
      style={{
        padding: 18,
        borderRadius: 14,
        border: destacado
          ? '1px solid rgba(43,224,106,0.28)'
          : '1px solid var(--hv-border)',
        boxShadow: destacado
          ? '0 0 30px rgba(43,224,106,0.08), var(--hv-inset-top)'
          : 'var(--hv-inset-top)',
      }}
    >
      <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="hv-mono"
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: accent === 'green' ? 'var(--hv-green-text)' : 'var(--hv-text)',
          letterSpacing: '-0.025em',
          lineHeight: 1,
        }}
      >
        {valor}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--hv-text-muted)',
            marginTop: 6,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function FilaEmisionPendiente({ t }: { t: Tokenizacion }) {
  const superficie = Number(t.campania.hectareasAfectadas ?? 0);
  return (
    <Link
      to={`/invertir/${t.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--hv-bg-panel)',
        border: '1px solid var(--hv-border)',
        borderRadius: 12,
        textDecoration: 'none',
        boxShadow: 'var(--hv-inset-top)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            style={{
              color: 'var(--hv-text)',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </span>
          <BadgeModo modo={t.modo} />
          {t.campania.estadoToken && <EstadoCampanaBadge estado={t.campania.estadoToken} />}
        </div>
        <div className="hv-label-sm" style={{ fontSize: 10 }}>
          {t.campania.cultivo?.nombre} · {superficie.toFixed(0)} ha ·{' '}
          {t.campania.cicloAgricola ?? ''}
        </div>
      </div>
      <div className="hidden md:block" style={{ width: 180 }}>
        <BarraFondeo vendidos={t.tokensVendidos} emitidos={t.tokensEmitidos} compacta />
      </div>
      <div className="text-right">
        <div
          className="hv-mono"
          style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600 }}
        >
          {usd(t.precioTokenUsd, 2)}
        </div>
        <div className="hv-label-sm" style={{ fontSize: 9 }}>
          por HRV
        </div>
      </div>
    </Link>
  );
}

function FilaParaCobrar({ t }: { t: Tokenizacion }) {
  return (
    <div
      className="flex flex-col md:flex-row md:items-center gap-4"
      style={{
        padding: '16px 20px',
        background: 'rgba(43,224,106,0.05)',
        border: '1px solid rgba(43,224,106,0.3)',
        borderRadius: 14,
        boxShadow: '0 0 24px rgba(43,224,106,0.08), var(--hv-inset-top)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Link to="/campanas" style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </Link>
          <BadgeModo modo={t.modo} />
        </div>
        <div className="hv-label-sm" style={{ fontSize: 10 }}>
          {toneladas(Number(t.tokensVendidos), 0)} vendidas de {toneladas(Number(t.tokensEmitidos), 0)} ·{' '}
          <span style={{ color: 'var(--hv-green-text)' }}>{usd(Number(t.montoRecaudadoUsd), 2)} USDC en el vault</span>
        </div>
      </div>
      <BotonCobrarSiembra t={t} compacto />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: 220,
            background: 'var(--hv-bg-panel)',
            border: '1px solid var(--hv-border)',
            borderRadius: 14,
          }}
        />
      ))}
    </div>
  );
}

function EstadoVacio() {
  return (
    <div
      className="hv-glass"
      style={{
        padding: 40,
        borderRadius: 16,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>🌱</div>
      <div
        style={{
          color: 'var(--hv-text)',
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Sin emisiones activas
      </div>
      <p style={{ color: 'var(--hv-text-muted)', fontSize: 13 }}>
        Cuando tu emisión sea aprobada por un admin, aparece acá.
      </p>
      <Link
        to="/campanas/nueva"
        style={{
          color: 'var(--hv-green-text)',
          fontSize: 12,
          textDecoration: 'none',
          marginTop: 16,
          display: 'inline-block',
          fontWeight: 600,
        }}
      >
        Tokenizar tu primera campaña →
      </Link>
    </div>
  );
}
