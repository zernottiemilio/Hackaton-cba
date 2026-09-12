import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SymbolProps {
  className?: string;
  variant?: 'light' | 'dark' | 'mono-dark' | 'mono-light';
  size?: number;
  animated?: boolean;
}

/**
 * Símbolo AgroFácil — 3 barras ascendentes + brote en la barra más alta.
 * Refleja el concepto de marca "Crecimiento medible": medición que florece.
 * Recreado como SVG inline para escalar limpio + animar.
 */
export function Logo({ className, variant = 'dark', size = 28, animated = false }: SymbolProps) {
  const color =
    variant === 'light'      ? '#FFFFFF'
    : variant === 'mono-dark'  ? '#0F172A'
    : variant === 'mono-light' ? '#FFFFFF'
    : '#047C00';

  // Geometría de las 3 barras (proporciones 1:2:3 con tops redondeados)
  const bars = [
    { x: 4,  y: 20, h: 9  },   // chica
    { x: 11, y: 14, h: 15 },   // media
    { x: 18, y: 7,  h: 22 },   // alta — la que tiene el brote
  ] as const;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="AgroFacil"
    >
      {/* Brote en el tope de la barra más alta */}
      <motion.path
        d="M21 7 C 24.2 3.5, 27.6 3, 29 4.2 C 27.6 6.5, 24.8 8, 21.5 7.5 Z"
        fill={color}
        initial={animated ? { opacity: 0, scale: 0.4, originX: '20px', originY: '7px' } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 220,
          damping: 18,
          delay: animated ? 0.35 : 0,
        }}
      />
      {/* Pequeño nervio del brote (efecto sutil de "tallo") */}
      <motion.path
        d="M21 7 L 22 6"
        stroke={color}
        strokeWidth="0.8"
        strokeLinecap="round"
        initial={animated ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.25, delay: animated ? 0.45 : 0 }}
      />

      {/* 3 barras crecientes */}
      {bars.map((b, i) => (
        <motion.rect
          key={i}
          x={b.x}
          width={3.6}
          rx={1.5}
          ry={1.5}
          fill={color}
          initial={animated ? { y: 29, height: 0 } : false}
          animate={{ y: b.y, height: b.h }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 22,
            delay: animated ? i * 0.07 : 0,
          }}
        />
      ))}
    </svg>
  );
}

/**
 * Logo + wordmark (lockup) — usar en login, hero, footer.
 * Camel-case "AgroFacil": "Agro" verde profundo + "Facil" verde principal.
 */
interface LockupProps {
  size?: number;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'color' | 'light';
  animated?: boolean;
}

export function LogoLockup({
  size = 36,
  className,
  orientation = 'horizontal',
  variant = 'color',
  animated = false,
}: LockupProps) {
  const isLight = variant === 'light';
  const agroColor  = isLight ? '#FFFFFF' : '#013E00';
  const facilColor = isLight ? '#FFFFFF' : '#047C00';

  if (orientation === 'vertical') {
    return (
      <div className={cn('inline-flex flex-col items-center gap-2', className)}>
        <Logo size={size * 1.4} variant={isLight ? 'light' : 'dark'} animated={animated} />
        <span
          className="font-extrabold tracking-tight"
          style={{ fontFamily: 'Plus Jakarta Sans, Inter var, system-ui, sans-serif', fontSize: size * 0.66 }}
        >
          <span style={{ color: agroColor }}>Agro</span>
          <span style={{ color: facilColor }}>Facil</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Logo size={size} variant={isLight ? 'light' : 'dark'} animated={animated} />
      <span
        className="font-extrabold tracking-tight leading-none"
        style={{
          fontFamily: 'Plus Jakarta Sans, Inter var, system-ui, sans-serif',
          fontSize: size * 0.62,
          letterSpacing: '-0.03em',
        }}
      >
        <span style={{ color: agroColor }}>Agro</span>
        <span style={{ color: facilColor }}>Facil</span>
      </span>
    </div>
  );
}
