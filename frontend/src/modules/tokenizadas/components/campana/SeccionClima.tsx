import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, Droplets, Thermometer } from 'lucide-react';
import { generarClima } from '../../services/mockDatosTecnicosService';

/**
 * Clima del ciclo actual vs promedio histórico de la zona.
 * Datos mockeados determinísticamente por tokenizacionId.
 * En prod: SMN + estación local + agrupación mensual.
 */
export function SeccionClima({ tokenizacionId }: { tokenizacionId: string }) {
  const datos = useMemo(() => generarClima(tokenizacionId), [tokenizacionId]);

  const semaforoColor: Record<typeof datos.semaforo, { color: string; texto: string; label: string }> = {
    verde: { color: 'var(--hv-green-text)', texto: 'Ciclo normal', label: 'Sin alertas' },
    amarillo: { color: 'var(--hv-amber-text)', texto: 'Déficit moderado', label: 'Vigilar' },
    rojo: { color: 'var(--hv-red-text)', texto: 'Estrés hídrico', label: 'Alerta' },
  };
  const semaforo = semaforoColor[datos.semaforo];

  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-sky-400" />
            Clima
          </h3>
          <p className="text-white/40 text-xs mt-1">
            Precipitación mensual del ciclo actual vs promedio histórico · {datos.fuente}
          </p>
        </div>
        <span
          className="hv-chip"
          style={{
            fontSize: 11,
            color: semaforo.color,
            borderColor: semaforo.color + '55',
            background: semaforo.color + '15',
          }}
        >
          <span className="hv-dot" style={{ background: semaforo.color }} />
          {semaforo.texto}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiClima
          icon={<Droplets className="h-3.5 w-3.5" />}
          label="Acumulado ciclo"
          valor={`${datos.acumuladoCicloMm} mm`}
          sub={`Prom: ${datos.promedioHistoricoCicloMm} mm`}
        />
        <KpiClima
          icon={<Droplets className="h-3.5 w-3.5" />}
          label="Déficit"
          valor={`${datos.deficitMm > 0 ? '−' : '+'}${Math.abs(datos.deficitMm)} mm`}
          sub={semaforo.label}
          tono={datos.semaforo}
        />
        <KpiClima
          icon={<Thermometer className="h-3.5 w-3.5" />}
          label="Temp media"
          valor={`${datos.temperaturaMediaC.toFixed(1)}°C`}
          sub={`Última lluvia hace ${datos.ultimaLluviaDiasAtras} d`}
        />
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={datos.serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{
                background: 'var(--hv-bg-panel)',
                border: '1px solid var(--hv-border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--hv-text)',
              }}
              labelStyle={{ color: 'var(--hv-text-muted)', fontSize: 10 }}
              formatter={((v: number, name: string) => [`${v} mm`, name === 'mm' ? 'Ciclo actual' : 'Promedio']) as never}
            />
            <Bar dataKey="promedioHistorico" fill="rgba(255,255,255,0.08)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="mm" fill="var(--hv-green)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2 text-[10px]">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--hv-text-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--hv-green)' }} />
          Ciclo actual
        </span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--hv-text-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
          Promedio histórico
        </span>
      </div>
    </div>
  );
}

function KpiClima({
  icon,
  label,
  valor,
  sub,
  tono,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  sub?: string;
  tono?: 'verde' | 'amarillo' | 'rojo';
}) {
  const color =
    tono === 'rojo' ? 'var(--hv-red-text)' : tono === 'amarillo' ? 'var(--hv-amber-text)' : 'var(--hv-text)';
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--hv-border-subtle)',
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div className="hv-label-sm flex items-center gap-1.5" style={{ fontSize: 9 }}>
        <span style={{ color: 'var(--hv-text-muted)' }}>{icon}</span>
        {label}
      </div>
      <div className="hv-mono" style={{ color, fontSize: 18, fontWeight: 600, marginTop: 4, lineHeight: 1 }}>
        {valor}
      </div>
      {sub && (
        <div style={{ color: 'var(--hv-text-muted)', fontSize: 10, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
