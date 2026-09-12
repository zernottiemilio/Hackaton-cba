import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatearUsd } from '@/utils/formatters';

export interface CostSegment {
  nombre: string;
  valor: number;
  color: string;
}

interface Props {
  data: CostSegment[];
  size?: number;
  showLegend?: boolean;
  centerValue?: string;
  centerLabel?: string;
}

const COLORES_DEFECTO = ['#047C00', '#0F7702', '#A8B948', '#F2A03C', '#E8B53D', '#B8482A'];

export function CostDonut({ data, size = 180, showLegend = true, centerValue, centerLabel }: Props) {
  const total = data.reduce((s, d) => s + d.valor, 0);
  const enriched = data.map((d, i) => ({
    ...d,
    color: d.color ?? COLORES_DEFECTO[i % COLORES_DEFECTO.length],
  }));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div className="shrink-0" style={{ width: size, height: size, position: 'relative' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={enriched}
              dataKey="valor"
              innerRadius={size * 0.32}
              outerRadius={size * 0.46}
              startAngle={90}
              endAngle={-270}
              paddingAngle={enriched.length > 1 ? 2 : 0}
              animationDuration={650}
              animationEasing="ease-out"
            >
              {enriched.map((s, i) => (
                <Cell key={i} fill={s.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid #E2E8E0',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [formatearUsd(Number(value) || 0), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue && (
              <span className="display-number text-lg leading-tight text-foreground">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {showLegend && (
        <ul className="flex-1 min-w-0 space-y-1.5 w-full">
          {enriched.map((s) => {
            const pct = total > 0 ? ((s.valor / total) * 100).toFixed(0) : '0';
            return (
              <li key={s.nombre} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="flex-1 truncate text-foreground capitalize">{s.nombre}</span>
                <span className="font-medium text-muted-foreground tabular-nums">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
