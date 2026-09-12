import type { EstadoCampanaToken } from '../../types/tokenizadas';

const ESTADOS: Record<EstadoCampanaToken, { label: string; color: string; dot: string }> = {
  borrador: { label: 'Borrador', color: 'bg-white/10 text-white/60', dot: 'bg-white/40' },
  en_revision: { label: 'En revisión', color: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30', dot: 'bg-amber-400' },
  rechazada: { label: 'Rechazada', color: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30', dot: 'bg-rose-400' },
  abierta: { label: 'Abierta', color: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30', dot: 'bg-emerald-400 animate-pulse' },
  fondeada: { label: 'Fondeada', color: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30', dot: 'bg-sky-400' },
  en_curso: { label: 'En curso', color: 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30', dot: 'bg-indigo-400 animate-pulse' },
  en_cosecha: { label: 'En cosecha', color: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30', dot: 'bg-orange-400 animate-pulse' },
  liquidada: { label: 'Liquidada', color: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30', dot: 'bg-purple-400' },
  cancelada: { label: 'Cancelada', color: 'bg-white/5 text-white/40', dot: 'bg-white/20' },
};

export function EstadoCampanaBadge({ estado }: { estado: EstadoCampanaToken }) {
  const cfg = ESTADOS[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
