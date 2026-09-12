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
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider ${cls} ${
        es
          ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
          : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {es ? 'Porcentual' : 'Fijo'}
    </span>
  );
}
