import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { lluviasService } from '@/services/lluviasService';
import { camposApi } from '../services/camposService';
import { useAuthStore } from '@/stores/authStore';

/**
 * Lluvias Harvest — registro y resumen anual de lluvias por campo.
 * Reutiliza `lluviasService` del MVP (endpoints `/lluvias/*`).
 */
export function LluviasHarvestPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const [campoId, setCampoId] = useState<string>('');
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [mostrarForm, setMostrarForm] = useState(false);

  const { data: campos = [] } = useQuery({
    queryKey: ['tk', 'campos'],
    queryFn: camposApi.listar,
    enabled: !!usuario,
  });

  useEffect(() => {
    if (!campoId && campos.length > 0) setCampoId(campos[0].id);
  }, [campoId, campos]);

  const { data: registros = [] } = useQuery({
    queryKey: ['lluvias', anio, campoId],
    queryFn: () => lluviasService.listar(anio, campoId || undefined),
    enabled: !!campoId,
  });

  const { data: resumen } = useQuery({
    queryKey: ['lluvias-resumen', anio, campoId],
    queryFn: () => lluviasService.resumen(anio, campoId || undefined),
    enabled: !!campoId,
  });

  const sincronizarMut = useMutation({
    mutationFn: () => lluviasService.sincronizar(60),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['lluvias'] });
      qc.invalidateQueries({ queryKey: ['lluvias-resumen'] });
      toast.success(
        `Sincronizado con Open-Meteo · ${r.creados} nuevos, ${r.actualizados} actualizados`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalAnio = resumen?.total ?? '0';
  const diasConLluvia = resumen?.diasConLluvia ?? 0;
  const maxDia = resumen?.maxDia ?? '0';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="hv-label" style={{ fontSize: 10 }}>Registro de lluvias</div>
          <h1
            style={{
              color: 'var(--hv-text)',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              marginTop: 6,
            }}
          >
            Lluvias del campo
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => sincronizarMut.mutate()}
            disabled={sincronizarMut.isPending}
            className="hv-cta-ghost"
            style={{ padding: '10px 16px', fontSize: 13 }}
          >
            {sincronizarMut.isPending ? 'Sincronizando...' : '↻ Sincronizar 60d'}
          </button>
          <button
            onClick={() => setMostrarForm(true)}
            className="hv-cta"
            style={{
              padding: '10px 16px',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Registrar lluvia
          </button>
        </div>
      </div>

      {/* Selectores */}
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
                {c.nombre}
              </option>
            ))
          )}
        </select>

        <span className="hv-label-sm ml-4" style={{ fontSize: 10 }}>Año</span>
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="hv-mono"
          style={{
            background: 'var(--hv-bg-input)',
            border: '1px solid var(--hv-border)',
            color: 'var(--hv-text)',
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          {[0, 1, 2].map((delta) => {
            const y = new Date().getFullYear() - delta;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
      </div>

      {/* Métricas del año */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricaCard label={`Total ${anio}`} valor={`${Number(totalAnio).toFixed(0)} mm`} accent />
        <MetricaCard label="Días con lluvia" valor={diasConLluvia.toString()} />
        <MetricaCard label="Máximo día" valor={`${Number(maxDia).toFixed(0)} mm`} />
      </div>

      {/* Por mes */}
      {resumen && resumen.porMes.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--hv-text)', marginBottom: 12 }}>
            Distribución mensual
          </h2>
          <div className="hv-glass" style={{ borderRadius: 14, padding: 20 }}>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2 items-end" style={{ height: 140 }}>
              {Array.from({ length: 12 }).map((_, i) => {
                const mes = resumen.porMes.find((m) => m.mes === i + 1);
                const mm = Number(mes?.mm ?? 0);
                const max = Math.max(...resumen.porMes.map((m) => Number(m.mm)), 1);
                const altura = (mm / max) * 100;
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5" style={{ height: '100%' }}>
                    <div className="flex-1 flex items-end w-full">
                      <div
                        style={{
                          width: '100%',
                          height: `${altura}%`,
                          minHeight: mm > 0 ? 4 : 0,
                          background: 'linear-gradient(180deg, var(--hv-green), var(--hv-green-deep))',
                          borderRadius: 4,
                        }}
                        title={`${mm.toFixed(0)} mm`}
                      />
                    </div>
                    <div className="hv-label-sm" style={{ fontSize: 9 }}>
                      {['E','F','M','A','M','J','J','A','S','O','N','D'][i]}
                    </div>
                    <div className="hv-mono" style={{ fontSize: 9, color: 'var(--hv-text-muted)' }}>
                      {mm.toFixed(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Registros recientes */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--hv-text)' }}>
            Registros recientes
          </h2>
          <span className="hv-label-sm">{registros.length} este año</span>
        </div>
        {registros.length === 0 ? (
          <div className="hv-glass" style={{ borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--hv-text-muted)' }}>
            Todavía no hay lluvias registradas para {anio}. Cargá la primera o sincronizá con Open-Meteo.
          </div>
        ) : (
          <div className="hv-glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  {['Fecha', 'Mm', 'Origen', 'Nota'].map((h) => (
                    <th
                      key={h}
                      className="hv-label-sm"
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.02)',
                        fontSize: 9,
                        borderBottom: '1px solid var(--hv-border-subtle)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.slice(0, 20).map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--hv-border-subtle)' }}>
                    <td className="hv-mono" style={{ padding: '10px 16px', color: 'var(--hv-text-2)' }}>
                      {new Date(r.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td className="hv-mono" style={{ padding: '10px 16px', color: 'var(--hv-text)', fontWeight: 600 }}>
                      {Number(r.mm).toFixed(1)} mm
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        className="hv-mono"
                        style={{
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: r.origen === 'open_meteo' ? 'var(--hv-green-soft)' : 'rgba(255,255,255,0.05)',
                          color: r.origen === 'open_meteo' ? 'var(--hv-green-text)' : 'var(--hv-text-muted)',
                          border: `1px solid ${r.origen === 'open_meteo' ? 'rgba(43,224,106,0.28)' : 'var(--hv-border)'}`,
                        }}
                      >
                        {r.origen}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--hv-text-muted)', fontSize: 12 }}>
                      {r.nota || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal registro manual */}
      {mostrarForm && (
        <FormRegistrarLluvia
          campoId={campoId}
          onCerrar={() => setMostrarForm(false)}
          onOk={() => {
            qc.invalidateQueries({ queryKey: ['lluvias'] });
            qc.invalidateQueries({ queryKey: ['lluvias-resumen'] });
            setMostrarForm(false);
          }}
        />
      )}
    </div>
  );
}

function MetricaCard({ label, valor, accent }: { label: string; valor: string; accent?: boolean }) {
  return (
    <div
      className="hv-glass"
      style={{
        padding: 18,
        borderRadius: 14,
        border: accent ? '1px solid rgba(43,224,106,0.3)' : '1px solid var(--hv-border)',
        boxShadow: accent
          ? '0 0 30px rgba(43,224,106,0.10), var(--hv-inset-top)'
          : 'var(--hv-inset-top)',
      }}
    >
      <div className="hv-label" style={{ fontSize: 10, marginBottom: 8 }}>{label}</div>
      <div
        className="hv-mono"
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: accent ? 'var(--hv-green-text)' : 'var(--hv-text)',
          letterSpacing: '-0.02em',
        }}
      >
        {valor}
      </div>
    </div>
  );
}

function FormRegistrarLluvia({
  campoId,
  onCerrar,
  onOk,
}: {
  campoId: string;
  onCerrar: () => void;
  onOk: () => void;
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [mm, setMm] = useState('');
  const [nota, setNota] = useState('');

  const registrar = useMutation({
    mutationFn: () =>
      lluviasService.registrar({
        establecimientoId: campoId,
        fecha,
        mm: Number(mm),
        nota: nota || undefined,
      }),
    onSuccess: () => {
      toast.success('Lluvia registrada');
      onOk();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hv-glass"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 24,
          borderRadius: 16,
        }}
      >
        <div className="hv-label" style={{ fontSize: 10, marginBottom: 4 }}>Nueva lluvia</div>
        <h3 style={{ color: 'var(--hv-text)', fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          Registrar precipitación
        </h3>
        <div className="space-y-3">
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="hv-mono"
              style={inputStyle}
            />
          </Campo>
          <Campo label="Milímetros">
            <input
              type="number"
              step="0.1"
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              placeholder="0.0"
              className="hv-mono"
              style={inputStyle}
            />
          </Campo>
          <Campo label="Nota (opcional)">
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: Tormenta con granizo leve"
              style={inputStyle}
            />
          </Campo>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onCerrar} className="hv-cta-ghost" style={{ flex: 1, padding: 12 }}>
            Cancelar
          </button>
          <button
            onClick={() => registrar.mutate()}
            disabled={registrar.isPending || !mm || Number(mm) < 0}
            className="hv-cta"
            style={{ flex: 1, padding: 12 }}
          >
            {registrar.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="hv-label" style={{ fontSize: 10, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--hv-bg-input)',
  border: '1px solid var(--hv-border)',
  color: 'var(--hv-text)',
  padding: '10px 12px',
  borderRadius: 10,
  fontSize: 14,
};
