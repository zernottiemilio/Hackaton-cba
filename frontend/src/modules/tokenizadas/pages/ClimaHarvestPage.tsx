import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { climaService } from '@/services/climaService';
import { camposApi } from '../services/camposService';
import { useAuthStore } from '@/stores/authStore';

/**
 * Clima Harvest — pronóstico y estado actual sobre un campo del productor.
 * Reutiliza `climaService` (Open-Meteo detrás) del MVP con lat/lon del campo elegido.
 */
export function ClimaHarvestPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const [campoId, setCampoId] = useState<string>('');

  const { data: campos = [] } = useQuery({
    queryKey: ['tk', 'campos'],
    queryFn: camposApi.listar,
    enabled: !!usuario,
  });

  useEffect(() => {
    if (!campoId && campos.length > 0) setCampoId(campos[0].id);
  }, [campoId, campos]);

  const campo = campos.find((c) => c.id === campoId);
  const lat = campo ? Number(campo.latitud) : undefined;
  const lon = campo ? Number(campo.longitud) : undefined;
  const tieneCoords = lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon);

  const { data: actual, isLoading: cargandoActual } = useQuery({
    queryKey: ['clima', 'actual', lat, lon],
    queryFn: () => climaService.actual(lat!, lon!),
    enabled: tieneCoords,
  });

  const { data: pronostico, isLoading: cargandoPronostico } = useQuery({
    queryKey: ['clima', 'pronostico', lat, lon],
    queryFn: () => climaService.pronostico(lat!, lon!),
    enabled: tieneCoords,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="hv-label" style={{ fontSize: 10 }}>Clima del campo</div>
        <h1
          style={{
            color: 'var(--hv-text)',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            marginTop: 6,
          }}
        >
          Estado atmosférico y pronóstico
        </h1>
      </div>

      {/* Selector de campo */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="hv-label-sm" style={{ fontSize: 10 }}>Campo</span>
        <select
          value={campoId}
          onChange={(e) => setCampoId(e.target.value)}
          className="hv-mono"
          style={{
            background: 'var(--hv-bg-input)',
            border: '1px solid var(--hv-border)',
            color: 'var(--hv-text)',
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 13,
            minWidth: 240,
          }}
        >
          {campos.length === 0 ? (
            <option value="">Sin campos cargados</option>
          ) : (
            campos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.partido ? `— ${c.partido}` : ''}
              </option>
            ))
          )}
        </select>
      </div>

      {!tieneCoords ? (
        <div className="hv-glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--hv-text)', fontSize: 15 }}>
            Este campo no tiene coordenadas cargadas.
          </div>
          <p style={{ color: 'var(--hv-text-muted)', fontSize: 12, marginTop: 6 }}>
            Editá el campo y agregá su ubicación para ver el clima.
          </p>
        </div>
      ) : (
        <>
          {/* Actual */}
          {cargandoActual ? (
            <div className="hv-glass" style={{ borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--hv-text-muted)' }}>
              Cargando clima actual...
            </div>
          ) : (
            actual && (
              <section
                className="hv-glass hv-radial"
                style={{
                  borderRadius: 20,
                  padding: 28,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 28,
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 96, lineHeight: 1 }}>{actual.info.icono}</div>
                <div>
                  <div className="hv-label" style={{ fontSize: 10 }}>Ahora en {campo?.nombre}</div>
                  <div
                    className="hv-mono"
                    style={{
                      fontSize: 56,
                      fontWeight: 600,
                      color: 'var(--hv-text)',
                      letterSpacing: '-0.03em',
                      lineHeight: 1,
                      marginTop: 6,
                    }}
                  >
                    {actual.temperatura.toFixed(0)}°
                  </div>
                  <div style={{ color: 'var(--hv-text-2)', fontSize: 15, marginTop: 4 }}>
                    {actual.info.descripcion}
                  </div>
                  <div
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6"
                    style={{ borderTop: '1px solid var(--hv-border-subtle)' }}
                  >
                    <MiniDato label="Sensación" value={`${actual.sensacion.toFixed(0)}°`} />
                    <MiniDato label="Humedad" value={`${actual.humedad}%`} />
                    <MiniDato label="Viento" value={`${actual.vientoKmh.toFixed(0)} km/h`} />
                    <MiniDato label="Lluvia" value={`${actual.lluvia.toFixed(1)} mm`} />
                  </div>
                </div>
              </section>
            )
          )}

          {/* Pronóstico 7 días */}
          {cargandoPronostico ? null : pronostico && pronostico.dias.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--hv-text)' }}>
                    Próximos días
                  </h2>
                  <p className="hv-label-sm" style={{ marginTop: 4 }}>
                    Vía Open-Meteo · actualización diaria
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {pronostico.dias.slice(0, 7).map((d, i) => (
                  <CardDia key={d.fecha} dia={d} esHoy={i === 0} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MiniDato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div className="hv-mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--hv-text)', marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}

function CardDia({ dia, esHoy }: { dia: import('@/services/climaService').DiaPronostico; esHoy: boolean }) {
  const fecha = new Date(dia.fecha);
  const nombreDia = esHoy
    ? 'Hoy'
    : fecha.toLocaleDateString('es-AR', { weekday: 'short' }).replace(/\./g, '');
  return (
    <div
      className="hv-glass"
      style={{
        padding: 14,
        borderRadius: 12,
        textAlign: 'center',
        border: esHoy
          ? '1px solid rgba(43,224,106,0.3)'
          : '1px solid var(--hv-border)',
      }}
    >
      <div
        className="hv-label-sm"
        style={{ fontSize: 9, marginBottom: 6, color: esHoy ? 'var(--hv-green-text)' : 'var(--hv-text-muted)' }}
      >
        {nombreDia}
      </div>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{dia.info.icono}</div>
      <div className="hv-mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--hv-text)', marginTop: 6 }}>
        {dia.tMax.toFixed(0)}°
        <span style={{ color: 'var(--hv-text-muted)', fontWeight: 400, marginLeft: 4 }}>
          {dia.tMin.toFixed(0)}°
        </span>
      </div>
      {dia.lluvia > 0 && (
        <div
          className="hv-mono"
          style={{ fontSize: 10, color: 'var(--hv-green-text)', marginTop: 4 }}
        >
          ☂ {dia.lluvia.toFixed(0)} mm
        </div>
      )}
    </div>
  );
}
