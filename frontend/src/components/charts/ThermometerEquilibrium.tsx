import { motion } from 'framer-motion';
import { formatearQqHa } from '@/utils/formatters';

interface Props {
  rindeActual: number;
  rindeEquilibrio: number;
  /** Eje máximo del termómetro. Si no se pasa, se calcula. */
  max?: number;
}

/**
 * "Termómetro" horizontal del rinde de equilibrio.
 * Muestra el rinde actual vs el rinde de indiferencia, resaltando
 * el margen de seguridad o el déficit.
 *
 * Diseño:
 * [───── zona pérdida (rojo claro) ───── ▲ equilibrio │ zona ganancia (verde) ─────]
 *                                          marcador rinde actual ↑ con etiqueta
 */
export function ThermometerEquilibrium({ rindeActual, rindeEquilibrio, max }: Props) {
  const maxAxis = max ?? Math.max(rindeActual, rindeEquilibrio) * 1.25 + 5;
  const pctEquilibrio = Math.min(100, Math.max(0, (rindeEquilibrio / maxAxis) * 100));
  const pctActual = Math.min(100, Math.max(0, (rindeActual / maxAxis) * 100));
  const ganancia = rindeActual >= rindeEquilibrio;
  const margen = rindeActual - rindeEquilibrio;

  return (
    <div className="w-full">
      <div className="relative">
        {/* Track base */}
        <div className="h-3 rounded-full bg-muted/70 overflow-hidden flex">
          <div className="h-full bg-destructive/15" style={{ width: `${pctEquilibrio}%` }} />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${100 - pctEquilibrio}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
            className="h-full bg-gradient-to-r from-primary/20 via-primary/35 to-primary/55"
          />
        </div>

        {/* Línea de equilibrio */}
        <motion.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -top-2 -bottom-2 w-px bg-foreground"
          style={{ left: `${pctEquilibrio}%` }}
        >
          <div className="absolute left-1/2 -translate-x-1/2 -top-7 whitespace-nowrap">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Equilibrio
            </div>
            <div className="text-xs font-bold text-foreground tabular-nums text-center">
              {formatearQqHa(rindeEquilibrio)}
            </div>
          </div>
        </motion.div>

        {/* Marcador rinde actual */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 180, damping: 24 }}
          className="absolute -top-4 -translate-x-1/2"
          style={{ left: `${pctActual}%` }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22">
            <motion.circle
              cx="11"
              cy="11"
              r="6"
              fill={ganancia ? '#047C00' : '#DC2626'}
              stroke="#FFFFFF"
              strokeWidth="2.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, type: 'spring', stiffness: 260, damping: 14 }}
            />
          </svg>
        </motion.div>

        {/* Etiqueta rinde actual */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="absolute top-7 -translate-x-1/2 text-center whitespace-nowrap"
          style={{ left: `${pctActual}%` }}
        >
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Tu rinde
          </div>
          <div className={`text-sm font-bold tabular-nums ${ganancia ? 'text-primary' : 'text-destructive'}`}>
            {formatearQqHa(rindeActual)}
          </div>
        </motion.div>
      </div>

      {/* Lectura humana */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className={`mt-16 rounded-xl p-4 border ${
          ganancia
            ? 'bg-primary/5 border-primary/30 text-foreground'
            : 'bg-destructive/5 border-destructive/30 text-foreground'
        }`}
      >
        <p className="text-sm">
          {ganancia ? (
            <>
              Estás <span className="font-bold text-primary">{formatearQqHa(Math.abs(margen))}</span> por encima
              del rinde de equilibrio. Margen de seguridad cómodo.
            </>
          ) : (
            <>
              Te faltan <span className="font-bold text-destructive">{formatearQqHa(Math.abs(margen))}</span> para
              cubrir costos. Por debajo del punto de indiferencia.
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
