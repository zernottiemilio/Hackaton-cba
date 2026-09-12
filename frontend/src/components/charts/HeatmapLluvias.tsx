import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatearFecha } from '@/utils/formatters';

interface Props {
  anio: number;
  /** Mapa de fecha YYYY-MM-DD → mm de lluvia */
  registros: Map<string, number>;
  /** Click sobre un día (incluso uno sin lluvia) */
  onSelectDay: (fechaIso: string) => void;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const CELL = 14; // tamaño de cada cuadradito
const GAP = 3;

/**
 * Heatmap anual de lluvias — estilo GitHub contribution graph adaptado al campo.
 * Cada columna = una semana. Cada fila = día de la semana (L–D).
 * Intensidad del verde según mm acumulados:
 *   0 mm → gris
 *   < 5 → verde muy claro
 *   < 15 → verde claro
 *   < 30 → verde
 *   >= 30 → verde profundo
 *
 * Click en un día abre el formulario para cargar/editar mm.
 */
export function HeatmapLluvias({ anio, registros, onSelectDay }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; date: Date; mm: number } | null>(null);

  const { semanas, mesLabels } = useMemo(() => {
    const start = new Date(Date.UTC(anio, 0, 1));
    const end = new Date(Date.UTC(anio + 1, 0, 1));

    // Empezamos desde el lunes de la semana del 1 de enero
    const startWeekday = (start.getUTCDay() + 6) % 7; // 0 = lunes
    const cursor = new Date(start);
    cursor.setUTCDate(cursor.getUTCDate() - startWeekday);

    const semanas: { date: Date | null; mm: number; key: string }[][] = [];
    let semanaActual: typeof semanas[number] = [];

    while (cursor < end || semanaActual.length > 0) {
      const fechaIso = cursor.toISOString().slice(0, 10);
      const inRange = cursor >= start && cursor < end;
      semanaActual.push({
        date: inRange ? new Date(cursor) : null,
        mm: inRange ? registros.get(fechaIso) ?? 0 : 0,
        key: fechaIso,
      });
      if (semanaActual.length === 7) {
        semanas.push(semanaActual);
        semanaActual = [];
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (cursor >= end && semanaActual.length === 0) break;
    }

    // Etiquetas de mes — primera vez que aparece un día del mes en cada columna
    const mesLabels: { x: number; mes: number }[] = [];
    let ultMes = -1;
    semanas.forEach((sem, col) => {
      const primerDia = sem.find((d) => d.date)?.date;
      if (primerDia && primerDia.getUTCMonth() !== ultMes) {
        ultMes = primerDia.getUTCMonth();
        mesLabels.push({ x: col * (CELL + GAP), mes: ultMes });
      }
    });

    return { semanas, mesLabels };
  }, [anio, registros]);

  const colorForMm = (mm: number): string => {
    if (mm <= 0) return '#E2E8E0'; // gris suave (border color del tema)
    if (mm < 5) return '#C2E5BD';
    if (mm < 15) return '#86C97D';
    if (mm < 30) return '#3FA73C';
    if (mm < 60) return '#047C00';
    return '#013E00';
  };

  const width = semanas.length * (CELL + GAP) + 32;
  const height = 7 * (CELL + GAP) + 28;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative inline-block" style={{ minWidth: width }}>
        <svg width={width} height={height}>
          {/* Etiquetas de mes */}
          <g transform="translate(28, 12)">
            {mesLabels.map(({ x, mes }) => (
              <text key={mes} x={x} y={0} fill="#5B6B5C" fontSize="10" className="font-medium">
                {MESES[mes]}
              </text>
            ))}
          </g>

          {/* Etiquetas de días (L, M, V) — opcional, suelto y discreto */}
          <g transform="translate(0, 28)">
            {DIAS_SEMANA.map((d, i) => (
              <text
                key={i}
                x={20}
                y={i * (CELL + GAP) + CELL - 3}
                fill="#5B6B5C"
                fontSize="9"
                textAnchor="end"
                opacity={i % 2 === 1 ? 1 : 0}  // Mostrar solo M, J, S
              >
                {d}
              </text>
            ))}
          </g>

          {/* Grid de celdas */}
          <g transform="translate(28, 22)">
            {semanas.map((sem, col) =>
              sem.map((d, row) => {
                if (!d.date) return null;
                const color = colorForMm(d.mm);
                return (
                  <motion.rect
                    key={d.key}
                    x={col * (CELL + GAP)}
                    y={row * (CELL + GAP)}
                    width={CELL}
                    height={CELL}
                    rx={2.5}
                    fill={color}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (col * 0.005), duration: 0.3 }}
                    className="cursor-pointer hover:stroke-foreground"
                    strokeWidth={hover?.date.getTime() === d.date.getTime() ? 1.5 : 0}
                    stroke={hover?.date.getTime() === d.date.getTime() ? '#0F172A' : 'transparent'}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                      setHover({ x: rect.left, y: rect.top, date: d.date!, mm: d.mm });
                    }}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelectDay(d.date!.toISOString().slice(0, 10))}
                  />
                );
              }),
            )}
          </g>
        </svg>

        {/* Tooltip flotante */}
        {hover && (
          <div
            className="fixed z-50 pointer-events-none bg-foreground text-background text-xs px-2 py-1 rounded shadow-lift"
            style={{
              left: hover.x + CELL / 2,
              top: hover.y - 32,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-medium">{formatearFecha(hover.date.toISOString())}</div>
            <div className="text-background/80 tabular-nums">
              {hover.mm > 0 ? `${hover.mm.toFixed(1)} mm` : 'sin registro'}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
        <span>Menos</span>
        {[0, 4, 14, 29, 59, 100].map((mm) => (
          <span
            key={mm}
            className="h-3 w-3 rounded-sm"
            style={{ background: colorForMm(mm) }}
            title={`${mm} mm`}
          />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}
