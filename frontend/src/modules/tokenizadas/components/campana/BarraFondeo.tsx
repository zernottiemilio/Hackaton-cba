import { motion } from 'framer-motion';

interface Props {
  vendidos: number;
  emitidos: number;
  reservados?: number;
  compacta?: boolean;
}

/**
 * Barra de progreso del fondeo. Muestra: tokens vendidos, reservados
 * (más claros, en fluido), y el resto disponible. Estilo trading.
 */
export function BarraFondeo({ vendidos, emitidos, reservados = 0, compacta = false }: Props) {
  const pctVendidos = emitidos > 0 ? (vendidos / emitidos) * 100 : 0;
  const pctReservados = emitidos > 0 ? (reservados / emitidos) * 100 : 0;
  const total = Math.min(100, pctVendidos + pctReservados);
  const casiLleno = total >= 90;

  return (
    <div className="w-full">
      <div className={`relative w-full ${compacta ? 'h-1.5' : 'h-2'} bg-white/5 rounded-full overflow-hidden`}>
        {/* Fondo con líneas diagonales muy sutiles (estilo orderbook) */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 8px)',
          }}
        />
        {/* Reservados (color más pálido, primero para que quede debajo) */}
        {pctReservados > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${total}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 bg-emerald-500/30"
          />
        )}
        {/* Vendidos (color pleno) */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pctVendidos}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`absolute inset-y-0 left-0 ${
            casiLleno
              ? 'bg-gradient-to-r from-orange-500 to-rose-500'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
          }`}
        />
        {/* Shimmer casi lleno */}
        {casiLleno && (
          <motion.div
            className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>
    </div>
  );
}
