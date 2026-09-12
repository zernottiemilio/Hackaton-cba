import { memo } from 'react';

interface Props {
  size?: number;
  variant?: 'mark' | 'lockup' | 'lockup-vertical';
  /** Si `true`, la línea superior de la curva anima suavemente. */
  animated?: boolean;
  className?: string;
  /** Muestra el subtítulo "La cosecha, líquida" bajo el wordmark. */
  tagline?: boolean;
}

/**
 * Logo Harvest.fi — variante 3d "Curvas de nivel" del kit oficial.
 * El campo visto desde arriba, dentro del disco. Cuatro curvas del más
 * profundo al más brillante marcan la topografía del lote.
 */
export const HarvestLogo = memo(function HarvestLogo({
  size = 40,
  variant = 'mark',
  animated = false,
  className = '',
  tagline = false,
}: Props) {
  if (variant === 'mark') {
    return <MarkSvg size={size} animated={animated} className={className} />;
  }

  const displaySize = variant === 'lockup-vertical' ? size * 1.4 : size;
  const fontSize = variant === 'lockup-vertical' ? size * 0.72 : size * 0.62;

  return (
    <div
      className={`inline-flex ${variant === 'lockup-vertical' ? 'flex-col items-start gap-3' : 'items-center gap-3'} ${className}`}
    >
      <MarkSvg size={displaySize} animated={animated} />
      <div className="flex flex-col leading-none" style={{ gap: 4 }}>
        <span
          className="font-semibold"
          style={{
            fontSize,
            letterSpacing: '-0.045em',
            color: 'var(--hv-text, #fafafa)',
            fontFamily: 'var(--hv-font-sans, "Golos Text", system-ui)',
            lineHeight: 0.95,
          }}
        >
          harvest<span style={{ color: 'var(--hv-green, #2BE06A)' }}>.fi</span>
        </span>
        {tagline && (
          <span
            className="hv-label-sm"
            style={{
              fontFamily: 'var(--hv-font-mono, "JetBrains Mono")',
              fontSize: Math.max(9, size * 0.22),
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--hv-text-muted, #7e887f)',
              marginTop: 2,
            }}
          >
            La cosecha, líquida
          </span>
        )}
      </div>
    </div>
  );
});

function MarkSvg({ size, animated, className = '' }: { size: number; animated?: boolean; className?: string }) {
  const clipId = `hv-mark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-label="harvest.fi"
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="60" cy="60" r="54" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="54" fill="rgba(43,224,106,0.10)" />
      <g clipPath={`url(#${clipId})`} strokeLinecap="round" fill="none" strokeWidth="9">
        <path d="M-6 106C22 106 34 84 60 84s40 22 66 22" stroke="#0A6B12" />
        <path d="M-6 82C22 82 34 60 60 60s40 22 66 22" stroke="#12912a" />
        <path d="M-6 58C22 58 34 36 60 36s40 22 66 22" stroke="#1fc04c" />
        <path
          d="M-6 34C22 34 34 12 60 12s40 22 66 22"
          stroke="#2BE06A"
          style={animated ? { animation: 'hv-contour 4s ease-in-out infinite' } : undefined}
        />
      </g>
    </svg>
  );
}

/** Ícono compacto para favicon o listados densos. */
export function HarvestMark({ size = 24 }: { size?: number }) {
  return <HarvestLogo variant="mark" size={size} />;
}
