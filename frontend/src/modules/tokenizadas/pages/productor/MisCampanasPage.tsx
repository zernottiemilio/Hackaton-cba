import { Link } from 'react-router-dom';
import { BotonPublicarDemo } from '../../components/campana/BotonPublicarDemo';
import { useQuery } from '@tanstack/react-query';
import { tokenizadasApi } from '../../services/tokenizadasService';
import { useAuthStore } from '@/stores/authStore';
import { BadgeModo } from '../../components/campana/BadgeModo';
import { EstadoCampanaBadge } from '../../components/campana/EstadoCampanaBadge';
import { BarraFondeo } from '../../components/campana/BarraFondeo';
import { BotonCobrarSiembra } from '../../components/campana/BotonCobrarSiembra';
import { usd, usdCompacto, toneladas, fecha } from '../../utils/format';
import type { Tokenizacion } from '../../types/tokenizadas';

/**
 * Mis emisiones del productor. Consume GET /tokenizadas/mis-campanas.
 * Es la pantalla del paso 4 de la demo: acá el productor ve cuánto se
 * vendió y cobra la siembra (release_funds).
 */
export function MisCampanasPage() {
  const usuario = useAuthStore((s) => s.usuario);

  const { data: emisiones = [], isLoading } = useQuery({
    queryKey: ['tk', 'mis-campanas'],
    queryFn: () => tokenizadasApi.misCampanas(),
    enabled: !!usuario,
    refetchInterval: 10_000,
  });

  const listasParaCobrar = emisiones.filter(listaParaCobrar);
  const resto = emisiones.filter((e) => !listaParaCobrar(e));

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="hv-label" style={{ fontSize: 10 }}>Panel del productor</div>
          <h1 style={{ color: 'var(--hv-text)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 6 }}>
            Mis emisiones
          </h1>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 13, marginTop: 4 }}>
            {emisiones.length} en total · se actualiza cada 10 segundos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BotonPublicarDemo />
          <Link to="/campanas/nueva" className="hv-cta" style={{ textDecoration: 'none', padding: '11px 18px', fontSize: 13 }}>
            + Tokenizar campaña
          </Link>
        </div>
      </section>

      {isLoading ? (
        <div className="hv-glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--hv-text-muted)' }}>
          Cargando emisiones…
        </div>
      ) : emisiones.length === 0 ? (
        <Vacio />
      ) : (
        <>
          {listasParaCobrar.length > 0 && (
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
                  {listasParaCobrar.length}
                </span>
              </div>
              <div className="space-y-2">
                {listasParaCobrar.map((t) => (
                  <FilaEmision key={t.id} t={t} destacada />
                ))}
              </div>
            </section>
          )}

          {resto.length > 0 && (
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--hv-text)', letterSpacing: '-0.02em', marginBottom: 12 }}>
                {listasParaCobrar.length > 0 ? 'Todas las emisiones' : 'Emisiones'}
              </h2>
              <div className="space-y-2">
                {resto.map((t) => (
                  <FilaEmision key={t.id} t={t} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function listaParaCobrar(t: Tokenizacion): boolean {
  return t.campania.estadoToken === 'abierta' && Number(t.tokensVendidos) >= Number(t.toneladasMinimas ?? 1);
}

function FilaEmision({ t, destacada = false }: { t: Tokenizacion; destacada?: boolean }) {
  const superficie = Number(t.campania.hectareasAfectadas ?? 0);
  const estado = t.campania.estadoToken;
  return (
    <div
      className="flex flex-col lg:flex-row lg:items-center gap-4"
      style={{
        padding: '16px 20px',
        background: destacada ? 'rgba(43,224,106,0.05)' : 'var(--hv-bg-panel)',
        border: `1px solid ${destacada ? 'rgba(43,224,106,0.3)' : 'var(--hv-border)'}`,
        borderRadius: 14,
        boxShadow: destacada ? '0 0 24px rgba(43,224,106,0.08), var(--hv-inset-top)' : 'var(--hv-inset-top)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Link
            to={`/invertir/${t.id}`}
            style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600, lineHeight: 1.2, textDecoration: 'none' }}
          >
            {t.campania.establecimiento?.nombre ?? t.campania.nombre}
          </Link>
          <BadgeModo modo={t.modo} />
          {estado && <EstadoCampanaBadge estado={estado} />}
        </div>
        <div className="hv-label-sm" style={{ fontSize: 10 }}>
          {t.campania.cultivo?.nombre} · {superficie.toFixed(0)} ha · {t.campania.cicloAgricola ?? ''}
          {t.fondeoHasta ? ` · cierra ${fecha(t.fondeoHasta)}` : ''}
        </div>
        <div className="mt-3 max-w-md">
          <BarraFondeo vendidos={Number(t.tokensVendidos)} emitidos={Number(t.tokensEmitidos)} compacta />
          <div className="flex justify-between mt-1">
            <span className="hv-label-sm" style={{ fontSize: 10 }}>
              {toneladas(Number(t.tokensVendidos), 0)} de {toneladas(Number(t.tokensEmitidos), 0)} vendidas
            </span>
            <span className="hv-label-sm" style={{ fontSize: 10 }}>
              mínimo {toneladas(Number(t.toneladasMinimas ?? 1), 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:gap-8 lg:text-right">
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>Precio por tn</div>
          <div className="hv-mono" style={{ color: 'var(--hv-text)', fontSize: 15, fontWeight: 600 }}>
            {usd(t.precioTokenUsd, 2)}
          </div>
        </div>
        <div>
          <div className="hv-label-sm" style={{ fontSize: 9 }}>Recaudado</div>
          <div className="hv-mono" style={{ color: 'var(--hv-green-text)', fontSize: 15, fontWeight: 600 }}>
            {usdCompacto(Number(t.montoRecaudadoUsd))}
          </div>
        </div>
      </div>

      <div className="lg:min-w-[190px] flex lg:justify-end">
        <BotonCobrarSiembra t={t} compacto />
      </div>
    </div>
  );
}

function Vacio() {
  return (
    <div className="hv-glass" style={{ padding: 48, borderRadius: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>🌱</div>
      <div style={{ color: 'var(--hv-text)', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Todavía no tenés emisiones</div>
      <p style={{ color: 'var(--hv-text-muted)', fontSize: 13 }}>Tokenizá una campaña y aparece acá con su fondeo.</p>
      <Link
        to="/campanas/nueva"
        style={{ color: 'var(--hv-green-text)', fontSize: 12, textDecoration: 'none', marginTop: 16, display: 'inline-block', fontWeight: 600 }}
      >
        Tokenizar tu primera campaña →
      </Link>
    </div>
  );
}
