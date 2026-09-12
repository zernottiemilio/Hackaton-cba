import type { ModoTokenizacion } from '../../types/tokenizadas';

/**
 * Badge que indica el modo de tokenización. Siempre visible en cards y ficha.
 * El modo cambia quién asume el riesgo de rinde — la UI lo hace obvio.
 */
export function BadgeModo({ modo, size = 'sm' }: { modo: ModoTokenizacion; size?: 'sm' | 'md' | 'lg' }) {
  const es = modo === 'porcentual';
  const cls =
    size === 'lg'
      ? 'text-sm px-3 py-1'
      : size === 'md'
      ? 'text-xs px-2.5 py-1'
      : 'text-[10px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase ${cls}`}
      style={{
        fontFamily: 'var(--hv-font-mono)',
        letterSpacing: '0.14em',
        background: es ? 'var(--hv-amber-soft)' : 'var(--hv-green-soft)',
        color: es ? 'var(--hv-amber-text)' : 'var(--hv-green-text)',
        border: `1px solid ${es ? 'var(--hv-amber-strong)' : 'rgba(43,224,106,0.28)'}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {es ? 'Porcentual' : 'Fijo'}
    </span>
  );
}
