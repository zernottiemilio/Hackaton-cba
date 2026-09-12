import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Leaf } from 'lucide-react';
import { generarNdvi } from '../../services/mockDatosTecnicosService';

/**
 * NDVI (Normalized Difference Vegetation Index) del lote vs curva típica
 * del cultivo. Sirve para ver si la biomasa acompañó la fenología esperada
 * — el valor puntual mata al productor en la explicación, la comparación
 * con lo típico le dice si está mejor o peor que un año promedio.
 */
export function SeccionNdvi({ tokenizacionId }: { tokenizacionId: string }) {
  const n = useMemo(() => generarNdvi(tokenizacionId), [tokenizacionId]);

  const estados = {
    vigoroso: { color: 'var(--hv-green-text)', label: 'Vigoroso', desc: 'Biomasa por encima del promedio del cultivo.' },
    normal: { color: 'var(--hv-text-2)', label: 'Normal', desc: 'Sigue la curva típica del cultivo.' },
    estresado: { color: 'var(--hv-amber-text)', label: 'Estresado', desc: 'Biomasa por debajo del promedio.' },
  } as const;
  const estado = estados[n.estado];

  return (
    <div className="bg-[#0F1216] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-400" />
            Trayectoria del cultivo · NDVI
          </h3>
          <p className="text-white/40 text-xs mt-1">
            Curva del lote (últimas 24 semanas) vs curva típica del cultivo · {n.fuente}
          </p>
        </div>
        <span
          className="hv-chip"
          style={{
            fontSize: 11,
            color: estado.color,
            borderColor: estado.color + '55',
            background: estado.color + '15',
          }}
        >
          <span className="hv-dot" style={{ background: estado.color }} />
          {estado.label}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <KpiNdvi label="NDVI lote" valor={n.actualLote.toFixed(2)} destacado />
        <KpiNdvi label="NDVI típico" valor={n.actualTipico.toFixed(2)} />
        <KpiNdvi
          label="Δ vs típico"
          valor={`${n.deltaPct >= 0 ? '+' : ''}${n.deltaPct.toFixed(1)}%`}
          tono={n.deltaPct >= 0 ? 'positivo' : 'negativo'}
        />
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 170 }}>
        <ResponsiveContainer>
          <LineChart data={n.serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
            <YAxis
              domain={[0, 1]}
              tick={{ fill: '#64748B', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--hv-bg-panel)',
                border: '1px solid var(--hv-border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--hv-text)',
              }}
              labelStyle={{ color: 'var(--hv-text-muted)', fontSize: 10 }}
              formatter={((v: number, name: string) => [
                v.toFixed(2),
                name === 'lote' ? 'Lote' : 'Típico',
              ]) as never}
            />
            <Line
              type="monotone"
              dataKey="tipico"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="lote"
              stroke="var(--hv-green)"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--hv-green)', stroke: 'var(--hv-bg-panel)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-3 pt-3 flex items-start gap-2"
        style={{ borderTop: '1px solid var(--hv-border-subtle)' }}
      >
        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--hv-text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 2,
                background: 'var(--hv-green)',
                borderRadius: 1,
              }}
            />
            Lote
          </span>
          <span className="flex items-center gap-1.5">
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 2,
                background: 'rgba(255,255,255,0.4)',
                borderRadius: 1,
              }}
            />
            Típico del cultivo
          </span>
        </div>
        <span className="ml-auto" style={{ color: 'var(--hv-text-muted)', fontSize: 11 }}>
          {estado.desc}
        </span>
      </div>
    </div>
  );
}

function KpiNdvi({
  label,
  valor,
  tono,
  destacado,
}: {
  label: string;
  valor: string;
  tono?: 'positivo' | 'negativo';
  destacado?: boolean;
}) {
  const color =
    tono === 'positivo'
      ? 'var(--hv-green-text)'
      : tono === 'negativo'
      ? 'var(--hv-amber-text)'
      : destacado
      ? 'var(--hv-text)'
      : 'var(--hv-text-2)';
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${destacado ? 'rgba(43,224,106,0.28)' : 'var(--hv-border-subtle)'}`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div className="hv-label-sm" style={{ fontSize: 9 }}>{label}</div>
      <div className="hv-mono" style={{ color, fontSize: 18, fontWeight: 600, marginTop: 4, lineHeight: 1 }}>
        {valor}
      </div>
    </div>
  );
}

