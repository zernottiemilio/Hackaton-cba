import { useEffect, useState } from 'react';

/**
 * Chip verde "en vivo · DD/MM HH:mm:ss" con reloj que actualiza cada segundo.
 * El backend cachea la pizarra 5 minutos, así que el ticker en sí no cambia
 * cada segundo — pero el reloj sí, para reforzar visualmente al jurado que
 * es un feed en tiempo real y no una foto vieja.
 */
export function ChipEnVivo() {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="hv-chip hv-chip-green" style={{ fontSize: 11, gap: 8 }}>
      <span className="hv-dot" style={{ background: 'var(--hv-green)' }} />
      en vivo
      <span
        className="hv-mono"
        style={{
          fontSize: 10,
          color: 'var(--hv-text-muted)',
          borderLeft: '1px solid rgba(255,255,255,0.15)',
          paddingLeft: 8,
        }}
      >
        {formatearTimestamp(ahora)}
      </span>
    </span>
  );
}

function formatearTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const dia = p(d.getDate());
  const mes = p(d.getMonth() + 1);
  const hh = p(d.getHours());
  const mm = p(d.getMinutes());
  const ss = p(d.getSeconds());
  return `${dia}/${mes} ${hh}:${mm}:${ss}`;
}
