import { memo } from 'react';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  /** Positivo = verde, negativo = rojo, cero = neutro. Si no pasa, se calcula. */
  tendencia?: 'up' | 'down' | 'flat';
  /** Muestra el área sombreada bajo la curva (estilo Binance). */
  area?: boolean;
  strokeWidth?: number;
}

/**
 * Mini-gráfico de línea sin ejes, sin labels — sólo la forma.
 * Se usa en cards, tickers y tablas para dar sensación de "vivo" y contexto.
 */
export const Sparkline = memo(function Sparkline({
  data,
  width = 80,
  height = 28,
  tendencia,
  area = true,
  strokeWidth = 1.5,
}: Props) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="opacity-20" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const rango = max - min || 1;
  const stepX = width / (data.length - 1);

  const puntos = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / rango) * height;
    return `${x},${y}`;
  });

  const trend = tendencia ?? (data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'flat');
  const color =
    trend === 'up' ? 'var(--tk-up, #16C784)' : trend === 'down' ? 'var(--tk-down, #EA3943)' : 'var(--tk-flat, #808A9D)';

  const linePath = `M ${puntos.join(' L ')}`;
  const areaPath = `M 0,${height} L ${puntos.join(' L ')} L ${width},${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      {area && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity={0.15}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
